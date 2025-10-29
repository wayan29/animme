const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

const BASE_URL = 'https://v1.samehadaku.how';
const PLAYER_AJAX_URL = `${BASE_URL}/wp-admin/admin-ajax.php`;

// Helper untuk generate hash dari URL gambar
function getImageHash(url) {
    return crypto.createHash('md5').update(url).digest('hex');
}

// Helper untuk store image URL mapping
const imageUrlMap = new Map();

function proxyImageUrl(url) {
    if (!url || !url.startsWith('http')) return url;
    const hash = getImageHash(url);
    imageUrlMap.set(hash, url);
    return `/img/${hash}`;
}

// Get Image URL Map (untuk server.js akses)
function getImageUrlMap() {
    return imageUrlMap;
}

// Extract slug from URL
function extractSlug(url) {
    if (!url) return '';
    const match = url.match(/\/anime\/([^\/]+)/);
    return match ? match[1] : '';
}

async function fetchAjaxPlayerIframe({ post, nume = '1', type = 'schtml' }) {
    if (!post) return null;
    const payload = new URLSearchParams({
        action: 'player_ajax',
        post,
        nume,
        type
    });
    
    try {
        const { data } = await axios.post(PLAYER_AJAX_URL, payload.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': BASE_URL,
                'Origin': BASE_URL
            }
        });
        if (!data) return null;
        const $ = cheerio.load(data);
        const iframeSrc = $('iframe').attr('src');
        return iframeSrc ? iframeSrc.trim() : null;
    } catch (error) {
        console.warn('fetchAjaxPlayerIframe error:', error.message);
        return null;
    }
}

// Scrape Homepage - Top 10 & Anime Terbaru
async function scrapeHome() {
    try {
        const { data } = await axios.get(BASE_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const result = {
            top10_weekly: [],
            project_movie: [],
            recent_anime: []
        };
        
        // Parse Top 10 minggu ini
        $('.topten-animesu ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a.series');
            const href = $link.attr('href');
            const title = $link.find('.judul').text().trim();
            const img = $link.find('img').attr('src');
            const rating = $link.find('.rating').text().replace(/★/g, '').trim();
            const rank = $link.find('.is-topten b:last-child').text().trim();
            
            if (title && href) {
                result.top10_weekly.push({
                    rank: parseInt(rank) || i + 1,
                    title: title,
                    slug: extractSlug(href),
                    poster: proxyImageUrl(img),
                    rating: rating
                });
            }
        });
        
        // Parse Project Movie Samehadaku
        $('.widgets h3:contains("Project Movie")').next('.widget-post').find('.widgetseries ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('.lftinfo h2 a.series');
            const $img = $el.find('.imgseries a.series img');
            const href = $link.attr('href');
            const title = $link.text().trim();
            const img = $img.attr('src');
            
            // Parse genres
            const genres = [];
            $el.find('.lftinfo span:contains("Genres") a').each((j, genreEl) => {
                genres.push($(genreEl).text().trim());
            });
            
            // Parse release date
            const releaseDate = $el.find('.lftinfo span').last().text().trim();
            
            if (title && href) {
                result.project_movie.push({
                    title: title,
                    slug: extractSlug(href),
                    poster: proxyImageUrl(img),
                    genres: genres,
                    release_date: releaseDate
                });
            }
        });
        
        // Parse Anime Terbaru dari homepage
        $('.post-show ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('.dtla h2.entry-title a');
            const $img = $el.find('.thumb img');
            
            // Extract episode number
            let episodeText = '';
            const $episodeSpan = $el.find('.dtla span:contains("Episode")');
            if ($episodeSpan.length > 0) {
                const episodeAuthor = $episodeSpan.find('author').text().trim();
                episodeText = episodeAuthor || $episodeSpan.text().replace(/Episode\s*/i, '').replace(/\s*Posted by.*/i, '').trim();
            }
            
            // Extract release date
            let releaseText = '';
            const $releaseSpan = $el.find('.dtla span:contains("Released on")');
            if ($releaseSpan.length > 0) {
                releaseText = $releaseSpan.text().replace(/Released on:\s*/i, '').trim();
            }
            
            const title = $link.text().trim();
            const href = $link.attr('href');
            
            if (title && href) {
                result.recent_anime.push({
                    title: title,
                    slug: extractSlug(href),
                    poster: proxyImageUrl($img.attr('src')),
                    current_episode: episodeText,
                    release_date: releaseText
                });
            }
        });
        
        return {
            status: 'success',
            data: result
        };
    } catch (error) {
        console.error('Error scraping samehadaku home:', error.message);
        throw error;
    }
}

// Scrape Anime Detail
async function scrapeAnimeDetail(slug) {
    try {
        const url = `${BASE_URL}/anime/${slug}/`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        
        const anime = {
            title: '',
            japanese_title: '',
            slug: slug,
            poster: '',
            rating: '',
            produser: '',
            type: '',
            status: '',
            episode_count: '',
            duration: '',
            release_date: '',
            studio: '',
            genres: [],
            synopsis: '',
            episode_lists: [],
            batch: null
        };
        
        // Parse title from main title
        const mainTitle = $('.entry-title').first().text().trim();
        anime.title = mainTitle.replace(/[Ss]ub\s+[Ii]ndo$/, '').trim();
        
        // Parse poster
        anime.poster = proxyImageUrl($('.infoanime .thumb img').attr('src'));
        
        // Parse rating
        const $rating = $('.archiveanime-rating span[itemprop="ratingValue"]');
        if ($rating.length > 0) {
            anime.rating = $rating.text().trim();
        }
        
        // Parse metadata from .spe spans
        $('.infoanime .spe span').each((i, el) => {
            const $el = $(el);
            const fullText = $el.text();
            
            if (fullText.includes('Japanese')) {
                anime.japanese_title = fullText.replace(/^.*Japanese\s+/, '').trim();
            } else if (fullText.includes('Synonyms')) {
                // Could parse synonyms if needed
            } else if (fullText.includes('Status')) {
                anime.status = fullText.replace(/^.*Status\s+/, '').trim();
            } else if (fullText.includes('Type')) {
                anime.type = fullText.replace(/^.*Type\s+/, '').trim();
            } else if (fullText.includes('Total Episode')) {
                anime.episode_count = fullText.replace(/^.*Total Episode\s+/, '').trim();
            } else if (fullText.includes('Duration')) {
                anime.duration = fullText.replace(/^.*Duration\s+/, '').trim();
            } else if (fullText.includes('Season')) {
                // If needed, could parse season
            } else if (fullText.includes('Studio')) {
                anime.studio = $el.find('a').text().trim();
            } else if (fullText.includes('Producers')) {
                const producers = [];
                $el.find('a').each((idx, a) => {
                    producers.push($(a).text().trim());
                });
                anime.produser = producers.join(', ');
            } else if (fullText.includes('Released:')) {
                anime.release_date = fullText.replace(/^.*Released:\s*/, '').trim();
            }
        });
        
        // Parse genres
        $('.infoanime .genre-info a').each((i, el) => {
            const $el = $(el);
            const href = $el.attr('href');
            const name = $el.text().trim();
            
            if (name && href) {
                const slugMatch = href.match(/\/genre\/([^\/]+)/);
                anime.genres.push({
                    name: name,
                    slug: slugMatch ? slugMatch[1] : ''
                });
            }
        });
        
        // Parse synopsis - get only the first paragraph (main synopsis)
        const $synopsisDiv = $('.entry-content-single');
        if ($synopsisDiv.length > 0) {
            const synopsisText = $synopsisDiv.html();
            const $temp = cheerio.load(synopsisText);
            // Remove any unwanted elements like ads, etc.
            $temp('a, strong, b').each((i, el) => {
                const $el = $temp(el);
                $el.replaceWith($el.text());
            });
            anime.synopsis = $temp.text().trim();
        }
        
        // Parse episode list
        $('.lstepsiode.listeps ul li').each((i, el) => {
            const $el = $(el);
            const $episodeLink = $el.find('.epsright .eps a');
            const $titleLink = $el.find('.epsleft .lchx a');
            const episodeNumber = $episodeLink.text().trim();
            const episodeTitle = $titleLink.text().trim();
            const href = $titleLink.attr('href');
            const releaseDate = $el.find('.epsleft .date').text().trim();
            
            if (href) {
                const slugMatch = href.match(/\/([^\/]+)\/$/);
                const episodeSlug = slugMatch ? slugMatch[1] : '';
                
                anime.episode_lists.push({
                    episode_number: episodeNumber,
                    slug: episodeSlug,
                    title: episodeTitle,
                    release_date: releaseDate
                });
            }
        });
        
        return {
            status: 'success',
            data: anime
        };
    } catch (error) {
        console.error('Error scraping samehadaku anime detail:', error.message);
        throw error;
    }
}

// Scrape Search
async function scrapeSearch(keyword) {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(keyword)}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const results = [];
        
        $('.post-show ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('.dtla h2 a');
            const $img = $el.find('.thumb img');
            
            const anime = {
                title: $link.text().trim(),
                slug: extractSlug($link.attr('href')),
                poster: proxyImageUrl($img.attr('src')),
                genres: [],
                status: '',
                rating: ''
            };
            
            results.push(anime);
        });
        
        return {
            status: 'success',
            data: results
        };
    } catch (error) {
        console.error('Error scraping samehadaku search:', error.message);
        throw error;
    }
}

// Scrape Anime Terbaru dengan Pagination
async function scrapeAnimeList(page = 1) {
    try {
        const url = page === 1 ? `${BASE_URL}/anime-terbaru/` : `${BASE_URL}/anime-terbaru/page/${page}/`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const results = [];
        
        // Scrape dari post-show area (16 items)
        $('.post-show ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('.dtla h2 a');
            const $img = $el.find('.thumb img');
            
            const anime = {
                title: $link.text().trim(),
                slug: extractSlug($link.attr('href')),
                poster: proxyImageUrl($img.attr('src')),
                current_episode: $el.find('.dtla span').first().text().replace(/Episode\s*/i, '').replace(/\s*Posted by.*/, '').trim(),
                release_date: $el.find('.dtla span:contains("Released on")').text().replace(/Released on:\s*/, '').trim()
            };
            
            results.push(anime);
        });
        
        // Debug info can be uncommented if needed
        // console.log(`[V2] Scraped ${results.length} anime from page ${page}`);
        
        // Parse Pagination - Extract from HTML structure
        let lastPage = page;
        
        // Method 1: Look for the span that contains "Page 1 of 675"
        const $paginationSpan = $('.pagination span').first();
        if ($paginationSpan.length > 0) {
            const spanText = $paginationSpan.text();
            const pageMatch = spanText.match(/Page\s+\d+\s+of\s+(\d+)/i);
            if (pageMatch) {
                lastPage = parseInt(pageMatch[1]);
            }
        }
        
        // Method 2: Get the highest page number from pagination links
        if (lastPage === page) {
            let highestPage = page;
            $('.pagination a').each((i, el) => {
                const href = $(el).attr('href');
                if (href) {
                    const pageMatch = href.match(/page\/(\d+)/);
                    if (pageMatch) {
                        const pageNum = parseInt(pageMatch[1]);
                        if (pageNum > highestPage) {
                            highestPage = pageNum;
                        }
                    }
                }
            });
            lastPage = highestPage;
        }
        
        // Method 3: Fallback - use any page number found in pagination text
        if (lastPage === page) {
            const paginationText = $('.pagination').text().trim();
            const allNumbers = paginationText.match(/\b\d{1,4}\b/g);
            if (allNumbers && allNumbers.length > 0) {
                // Find the largest reasonable page number (not too big like 675123)
                const reasonablePages = allNumbers
                    .map(n => parseInt(n))
                    .filter(n => n > page && n < 10000)
                    .sort((a, b) => a - b);
                if (reasonablePages.length > 0) {
                    lastPage = reasonablePages[reasonablePages.length - 1];
                }
            }
        }
        
        const pagination = {
            current_page: page,
            has_next_page: page < lastPage,
            has_previous_page: page > 1,
            next_page: page + 1,
            previous_page: page - 1,
            last_page: lastPage,
            total_pages: lastPage
        };
        
        // Also check if next button exists as fallback
        const $nextBtn = $('.pagination .next');
        if ($nextBtn.length > 0) {
            pagination.has_next_page = true;
        }
        
        return {
            status: 'success',
            data: {
                animeData: results,
                paginationData: pagination
            }
        };
    } catch (error) {
        console.error('Error scraping samehadaku anime list:', error.message);
        throw error;
    }
}

// Scrape Schedule (Jadwal Rilis)
async function scrapeSchedule() {
    try {
        const url = `${BASE_URL}/jadwal-rilis/`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const schedule = {};
        
        // Parse each day schedule
        $('.kglist321').each((i, el) => {
            const $el = $(el);
            const day = $el.find('h2').text().trim();
            const animeList = [];
            
            $el.find('ul li a').each((idx, linkEl) => {
                const $link = $(linkEl);
                const title = $link.text().trim();
                const href = $link.attr('href');
                
                let slug = '';
                if (href) {
                    const slugMatch = href.match(/\/anime\/([^\/]+)/);
                    slug = slugMatch ? slugMatch[1] : '';
                }
                
                if (title && slug) {
                    animeList.push({
                        title: title,
                        slug: slug
                    });
                }
            });
            
            if (day && animeList.length > 0) {
                schedule[day] = animeList;
            }
        });
        
        return {
            status: 'success',
            data: schedule
        };
    } catch (error) {
        console.error('Error scraping samehadaku schedule:', error.message);
        throw error;
    }
}

// Scrape Episode Detail
async function scrapeEpisode(episodeSlug) {
    try {
        const url = `${BASE_URL}/${episodeSlug}/`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        
        const episode = {
            title: $('.entry-title').text().trim(),
            slug: episodeSlug,
            anime_title: '',
            episode_number: '',
            default_stream_url: '',
            download_links: [],
            download_sections: [],
            prev_episode: null,
            next_episode: null,
            poster: '',
            release_time: '',
            description: '',
            anime_slug: '',
            post_id: '',
            stream_servers: []
        };
        
        const posterSrc = $('.cukder img').attr('src')
            || $('.episodeinf .thumb img').attr('src')
            || $('.player-area img').attr('src');
        episode.poster = posterSrc ? proxyImageUrl(posterSrc) : '';
        
        // Extract post id from article id attribute
        const articleId = $('article[id^="post-"]').attr('id');
        if (articleId) {
            const postMatch = articleId.match(/post-(\d+)/);
            if (postMatch) {
                episode.post_id = postMatch[1];
            }
        }
        
        // Extract episode number and anime title
        const titleMatch = episode.title.match(/^(.+?)\s+Episode\s+(\d+)/i);
        if (titleMatch) {
            episode.anime_title = titleMatch[1].trim();
            episode.episode_number = titleMatch[2];
        }
        
        // Extract release time / posted info
        const releaseInfo = $('.sbdbti .time-post').text().replace(/\s+/g, ' ').trim();
        if (releaseInfo) {
            episode.release_time = releaseInfo;
        }
        
        // Extract synopsis/description
        const descriptionHtml = $('.entry-content.entry-content-single').first();
        if (descriptionHtml.length > 0) {
            episode.description = descriptionHtml.text().replace(/\s+\n/g, '\n').trim();
        }
        
        // Extract anime slug from "All Episode" link
        const animeLink = $('.naveps .nvsc a').attr('href');
        if (animeLink) {
            const animeSlugMatch = animeLink.match(/\/anime\/([^\/]+)/);
            if (animeSlugMatch) {
                episode.anime_slug = animeSlugMatch[1];
            }
        }
        
        // Extract streaming server options (labels & ajax params)
        const playerOptions = [];
        $('.east_player_option').each((i, el) => {
            const $el = $(el);
            const option = {
                label: $el.text().trim(),
                post_id: $el.attr('data-post') || '',
                nume: $el.attr('data-nume') || '1',
                type: $el.attr('data-type') || 'schtml'
            };
            if (!episode.post_id && option.post_id) {
                episode.post_id = option.post_id;
            }
            playerOptions.push(option);
        });
        episode.stream_servers = playerOptions;
        
        // Extract default iframe URL (direct embed on page)
        const defaultIframe = $('.responsive-embed-stream iframe').attr('src');
        if (defaultIframe) {
            episode.default_stream_url = defaultIframe;
        }
        
        // Parse download sections (grouped by format)
        $('.download-eps').each((sectionIndex, sectionEl) => {
            const $section = $(sectionEl);
            const label = $section.find('p b').first().text().trim() || $section.find('p').first().text().trim();
            const entries = [];
            
            $section.find('ul li').each((i, el) => {
                const $el = $(el);
                const quality = $el.find('strong').text().trim();
                const size = $el.find('i').text().trim();
                const links = [];
                
                $el.find('a').each((j, a) => {
                    const $a = $(a);
                    const hostName = $a.text().trim();
                    const href = $a.attr('href');
                    if (hostName && href) {
                        links.push({
                            host: hostName,
                            url: href
                        });
                    }
                });
                
                if (quality && links.length > 0) {
                    const item = {
                        quality: quality,
                        size: size,
                        links: links
                    };
                    entries.push(item);
                    episode.download_links.push(item);
                }
            });
            
            if (entries.length > 0) {
                episode.download_sections.push({
                    label: label || `Format ${sectionIndex + 1}`,
                    items: entries
                });
            }
        });
        
        // Parse prev/next episode
        $('.flir a').each((i, el) => {
            const $link = $(el);
            const href = $link.attr('href');
            const text = $link.text().trim().toLowerCase();
            
            if (text.includes('prev') || text.includes('sebelum')) {
                const prevSlugMatch = href ? href.match(/\/([^\/]+)\/$/) : null;
                episode.prev_episode = prevSlugMatch ? prevSlugMatch[1] : '';
            } else if (text.includes('next') || text.includes('selanjutnya')) {
                const nextSlugMatch = href ? href.match(/\/([^\/]+)\/$/) : null;
                episode.next_episode = nextSlugMatch ? nextSlugMatch[1] : '';
            }
        });
        
        // Fallback: fetch iframe from admin-ajax when default still empty
        if ((!episode.default_stream_url) && episode.post_id) {
            const primaryOption = playerOptions[0] || null;
            const ajaxParams = {
                post: episode.post_id,
                nume: primaryOption ? primaryOption.nume : '1',
                type: primaryOption ? primaryOption.type : 'schtml'
            };
            try {
                const iframeSrc = await fetchAjaxPlayerIframe(ajaxParams);
                if (iframeSrc) {
                    episode.default_stream_url = iframeSrc;
                }
            } catch (error) {
                console.warn('Failed to fetch ajax player iframe:', error.message);
            }
        }
        
        return {
            status: 'success',
            data: episode
        };
    } catch (error) {
        console.error('Error scraping samehadaku episode:', error.message);
        throw error;
    }
}

// Scrape All Anime (Daftar Anime) with filters and pagination
async function scrapeAllAnime(filters = {}, page = 1) {
    try {
        // Build URL with query parameters
        const params = new URLSearchParams();
        
        if (filters.title) params.append('title', filters.title);
        if (filters.status) params.append('status', filters.status);
        if (filters.type) params.append('type', filters.type);
        if (filters.order) params.append('order', filters.order);
        if (filters.genre && Array.isArray(filters.genre)) {
            filters.genre.forEach(g => params.append('genre[]', g));
        }
        
        const queryString = params.toString();
        
        // Build URL with page number
        let url;
        if (page > 1) {
            url = queryString 
                ? `${BASE_URL}/daftar-anime-2/page/${page}/?${queryString}`
                : `${BASE_URL}/daftar-anime-2/page/${page}/`;
        } else {
            url = queryString 
                ? `${BASE_URL}/daftar-anime-2/?${queryString}`
                : `${BASE_URL}/daftar-anime-2/`;
        }
        
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const results = [];
        
        // Parse anime list from .relat container
        $('.relat article.animpost').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('.animposx a');
            const $img = $link.find('.content-thumb img');
            const $title = $link.find('.data .title h2');
            const $status = $link.find('.data .type');
            const $typeLabel = $link.find('.content-thumb .type');
            const $rating = $link.find('.content-thumb .score');
            
            // Get metadata from tooltip
            const $tooltip = $el.find('.stooltip');
            const $views = $tooltip.find('.metadata span:contains("Views")');
            const synopsis = $tooltip.find('.ttls').text().trim();
            
            // Parse genres from tooltip
            const genres = [];
            $tooltip.find('.genres .mta a').each((j, genreEl) => {
                const genreName = $(genreEl).text().trim();
                const genreHref = $(genreEl).attr('href');
                const genreSlugMatch = genreHref ? genreHref.match(/\/genre\/([^\/]+)/) : null;
                
                if (genreName && genreSlugMatch) {
                    genres.push({
                        name: genreName,
                        slug: genreSlugMatch[1]
                    });
                }
            });
            
            const title = $title.text().trim();
            const href = $link.attr('href');
            const slug = extractSlug(href);
            
            if (title && slug) {
                results.push({
                    title: title,
                    slug: slug,
                    poster: proxyImageUrl($img.attr('src')),
                    type: $typeLabel.text().trim(),
                    status: $status.text().trim(),
                    rating: $rating.text().replace(/★/g, '').trim(),
                    views: $views.text().replace(/\s*Views/, '').trim(),
                    synopsis: synopsis,
                    genres: genres
                });
            }
        });
        
        // Parse available filters/options from the page
        const availableFilters = {
            statuses: [],
            types: [],
            sorts: [],
            genres: []
        };
        
        // Parse status options
        $('input[name="status"]').each((i, el) => {
            const $el = $(el);
            const value = $el.attr('value');
            const label = $el.parent().text().trim();
            if (value && label) {
                availableFilters.statuses.push({ value, label });
            }
        });
        
        // Parse type options
        $('input[name="type"]').each((i, el) => {
            const $el = $(el);
            const value = $el.attr('value');
            const label = $el.parent().text().trim();
            if (value && label) {
                availableFilters.types.push({ value, label });
            }
        });
        
        // Parse sort options
        $('input[name="order"]').each((i, el) => {
            const $el = $(el);
            const value = $el.attr('value');
            const label = $el.parent().text().trim();
            if (value && label) {
                availableFilters.sorts.push({ value, label });
            }
        });
        
        // Parse genre options
        $('input[name="genre[]"]').each((i, el) => {
            const $el = $(el);
            const value = $el.attr('value');
            const label = $el.parent().text().trim();
            if (value && label) {
                availableFilters.genres.push({ value, label });
            }
        });
        
        // Parse pagination info
        const pagination = {
            current_page: page,
            has_next_page: false,
            has_previous_page: page > 1,
            next_page: page + 1,
            previous_page: page - 1,
            last_page: page,
            total_pages: page
        };
        
        // Try to find pagination info in the page
        const $pagination = $('.pagination');
        if ($pagination.length > 0) {
            let maxPage = page;
            
            // First priority: Look for "Page X of Y" span (most reliable)
            let foundPageOf = false;
            $pagination.find('span').each((i, el) => {
                const $el = $(el);
                const text = $el.text().trim();
                const pageOfMatch = text.match(/^Page\s+(\d+)\s+of\s+(\d+)$/i);
                if (pageOfMatch) {
                    maxPage = parseInt(pageOfMatch[2]);
                    foundPageOf = true;
                    // If current page is less than max page, there's a next page
                    if (page < maxPage) {
                        pagination.has_next_page = true;
                    }
                    return false; // Break loop
                }
            });
            
            if (!foundPageOf) {
                // Fallback: Try to extract page numbers from links
                $pagination.find('a').each((i, el) => {
                    const $el = $(el);
                    const href = $el.attr('href');
                    const text = $el.text().trim();
                    
                    // Check href for page number
                    if (href) {
                        const pageMatch = href.match(/page\/(\d+)/);
                        if (pageMatch) {
                            const pageNum = parseInt(pageMatch[1]);
                            if (pageNum > page) {
                                pagination.has_next_page = true;
                            }
                            if (pageNum > maxPage) {
                                maxPage = pageNum;
                            }
                        }
                    }
                    
                    // Check text for page number (only pure numbers)
                    const textNum = parseInt(text);
                    if (!isNaN(textNum) && text === textNum.toString()) {
                        if (textNum > maxPage) {
                            maxPage = textNum;
                        }
                    }
                });
                
                // Look for "next" arrow or button
                $pagination.find('a').each((i, el) => {
                    const $el = $(el);
                    const className = $el.attr('class') || '';
                    const id = $el.attr('id') || '';
                    const html = $el.html();
                    
                    // Check for next indicators
                    if (className.includes('arrow_pag') || 
                        id.includes('nextpagination') || 
                        className.includes('next') ||
                        html.includes('fa-caret-right') ||
                        html.includes('fa-arrow-right')) {
                        pagination.has_next_page = true;
                    }
                });
            }
            
            pagination.last_page = maxPage;
            pagination.total_pages = maxPage;
        }
        
        return {
            status: 'success',
            data: {
                animeData: results,
                filters: availableFilters,
                currentFilters: filters,
                pagination: pagination,
                total_results: results.length
            }
        };
    } catch (error) {
        console.error('Error scraping samehadaku all anime:', error.message);
        throw error;
    }
}

module.exports = {
    scrapeHome,
    scrapeAnimeDetail,
    scrapeSearch,
    scrapeAnimeList,
    scrapeSchedule,
    scrapeEpisode,
    scrapeAllAnime,
    getImageUrlMap,
    fetchAjaxPlayerIframe
};
