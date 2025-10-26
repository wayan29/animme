const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

const BASE_URL = 'https://v1.samehadaku.how';

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
            title: $('.entry-title').text().trim(),
            slug: slug,
            poster: proxyImageUrl($('.infoanime .thumb img').attr('src')),
            rating: '',
            type: '',
            status: '',
            episode_count: '',
            genres: [],
            synopsis: $('.entry-content-single').text().trim(),
            episode_lists: []
        };
        
        // Parse info dari tabel
        $('.infoanime .spe span').each((i, el) => {
            const $el = $(el);
            const text = $el.text();
            
            if (text.includes('Status:')) {
                anime.status = text.replace('Status:', '').trim();
            } else if (text.includes('Type:')) {
                anime.type = text.replace('Type:', '').trim();
            } else if (text.includes('Total Episode:')) {
                anime.episode_count = text.replace('Total Episode:', '').trim();
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
        
        // Parse episode list
        $('.lstepsiode.listeps ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a');
            const episodeTitle = $link.text().trim();
            const href = $link.attr('href');
            
            if (href) {
                const slugMatch = href.match(/\/([^\/]+)\/$/);
                const episodeSlug = slugMatch ? slugMatch[1] : '';
                
                // Extract episode number
                const episodeMatch = episodeTitle.match(/Episode\s+(\d+)/i);
                const episodeNumber = episodeMatch ? episodeMatch[1] : '';
                
                anime.episode_lists.push({
                    episode_number: episodeNumber,
                    slug: episodeSlug,
                    title: episodeTitle,
                    release_date: $el.find('.date').text().trim()
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
            prev_episode: null,
            next_episode: null,
            poster: proxyImageUrl($('.cukder img').attr('src'))
        };
        
        // Extract episode number and anime title
        const titleMatch = episode.title.match(/^(.+?)\s+Episode\s+(\d+)/i);
        if (titleMatch) {
            episode.anime_title = titleMatch[1].trim();
            episode.episode_number = titleMatch[2];
        }
        
        // Extract default iframe URL
        const defaultIframe = $('.responsive-embed-stream iframe').attr('src');
        if (defaultIframe) {
            episode.default_stream_url = defaultIframe;
        }
        
        // Parse download links
        $('.download-eps ul li').each((i, el) => {
            const $el = $(el);
            const quality = $el.find('strong').text().trim();
            const size = $el.find('i').text().trim();
            const links = [];
            
            $el.find('a').each((j, a) => {
                const $a = $(a);
                links.push({
                    host: $a.text().trim(),
                    url: $a.attr('href')
                });
            });
            
            if (quality && links.length > 0) {
                episode.download_links.push({
                    quality: quality,
                    size: size,
                    links: links
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
        
        return {
            status: 'success',
            data: episode
        };
    } catch (error) {
        console.error('Error scraping samehadaku episode:', error.message);
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
    getImageUrlMap
};
