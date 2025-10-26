const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

const BASE_URL = 'https://otakudesu.best';

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

// Scrape Homepage - Ongoing & Complete Anime
async function scrapeHome() {
    try {
        const { data } = await axios.get(BASE_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const result = {
            ongoing_anime: [],
            complete_anime: []
        };
        
        // Parse Ongoing Anime
        $('.rseries .rapi').eq(0).find('.venz ul li').each((i, el) => {
            const $el = $(el);
            const $thumb = $el.find('.thumb a');
            const $img = $el.find('.thumbz img');
            
            const anime = {
                title: $el.find('.jdlflm').text().trim(),
                slug: extractSlug($thumb.attr('href')),
                poster: proxyImageUrl($img.attr('src')),
                current_episode: $el.find('.epz').text().replace('Episode ', '').trim(),
                release_day: $el.find('.epztipe').text().trim()
            };
            
            result.ongoing_anime.push(anime);
        });
        
        // Parse Complete Anime
        $('.rseries .rapi').eq(1).find('.venz ul li').each((i, el) => {
            const $el = $(el);
            const $thumb = $el.find('.thumb a');
            const $img = $el.find('.thumbz img');
            
            const anime = {
                title: $el.find('.jdlflm').text().trim(),
                slug: extractSlug($thumb.attr('href')),
                poster: proxyImageUrl($img.attr('src')),
                episode_count: $el.find('.epz').text().replace(' Episode', '').trim(),
                rating: $el.find('.epztipe').text().trim()
            };
            
            result.complete_anime.push(anime);
        });
        
        return {
            status: 'success',
            data: result
        };
    } catch (error) {
        console.error('Error scraping home:', error.message);
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
        
        // Helper function to extract value after colon from span
        function extractInfoValue(selector) {
            const text = $(selector).text().trim();
            const colonIndex = text.indexOf(':');
            if (colonIndex !== -1) {
                return text.substring(colonIndex + 1).trim();
            }
            return text;
        }
        
        const anime = {
            title: extractInfoValue('.infozingle p:contains("Judul") span'),
            japanese_title: extractInfoValue('.infozingle p:contains("Japanese") span'),
            slug: slug,
            poster: proxyImageUrl($('.fotoanime img').attr('src')),
            rating: extractInfoValue('.infozingle p:contains("Skor") span'),
            produser: extractInfoValue('.infozingle p:contains("Produser") span'),
            type: extractInfoValue('.infozingle p:contains("Tipe") span'),
            status: extractInfoValue('.infozingle p:contains("Status") span'),
            episode_count: extractInfoValue('.infozingle p:contains("Total Episode") span'),
            duration: extractInfoValue('.infozingle p:contains("Durasi") span'),
            release_date: extractInfoValue('.infozingle p:contains("Tanggal Rilis") span'),
            studio: extractInfoValue('.infozingle p:contains("Studio") span'),
            genres: [],
            synopsis: $('.sinopc p').text().trim() || $('.sinopc').text().trim(),
            episode_lists: [],
            batch: null
        };
        
        // Parse genres
        $('.infozingle p:contains("Genre") span a').each((i, el) => {
            const href = $(el).attr('href');
            const name = $(el).text().trim();
            
            if (name && href) {
                // Extract slug from href (/genres/action/ -> action)
                const slugMatch = href.match(/\/genres\/([^\/]+)/);
                const genreSlug = slugMatch ? slugMatch[1] : '';
                
                anime.genres.push({
                    name: name,
                    slug: genreSlug
                });
            }
        });
        
        // Parse episode list - only from the episode list section, not batch
        $('.episodelist').each((idx, episodeSection) => {
            const $section = $(episodeSection);
            const sectionTitle = $section.find('.smokelister .monktit').text().trim();
            
            // Skip batch sections
            if (sectionTitle.toLowerCase().includes('batch') || 
                sectionTitle.toLowerCase().includes('lengkap')) {
                return;
            }
            
            // Parse episodes from this section
            $section.find('ul li').each((i, el) => {
                const $link = $(el).find('span a').first();
                const releaseDate = $(el).find('.zeebr').text().trim();
                
                if ($link.length > 0) {
                    const episodeTitle = $link.text().trim();
                    const href = $link.attr('href');
                    
                    // Extract episode slug from href (/episode/snda-episode-4-sub-indo/ -> snda-episode-4-sub-indo)
                    let episodeSlug = '';
                    if (href) {
                        const slugMatch = href.match(/\/episode\/([^\/]+)/);
                        episodeSlug = slugMatch ? slugMatch[1] : '';
                    }
                    
                    // Extract episode number from title first
                    let episodeNumber = '';
                    const episodeMatch = episodeTitle.match(/Episode\s+(\d+)/i);
                    if (episodeMatch) {
                        episodeNumber = episodeMatch[1];
                    } else if (episodeSlug) {
                        // If no episode number in title, try to extract from slug or title keywords
                        // Examples: aktsyn-ova-3-sub-indo -> OVA 3
                        //           aktsyn-ova-sub-indo -> OVA
                        //           aktsyn-movie-sub-indo -> Movie
                        //           aktsyn-special-2-sub-indo -> Special 2
                        const ovaMatch = episodeSlug.match(/ova(?:[-_]?(\d+))?/i) || episodeTitle.match(/OVA(?:\s+(\d+))?/i);
                        const specialMatch = episodeSlug.match(/special(?:[-_]?(\d+))?/i) || episodeTitle.match(/Special(?:\s+(\d+))?/i);
                        const movieMatch = episodeSlug.match(/movie(?:[-_]?(\d+))?/i) || episodeTitle.match(/Movie(?:\s+(\d+))?/i);

                        if (ovaMatch) {
                            episodeNumber = ovaMatch[1] ? `OVA ${ovaMatch[1]}` : 'OVA';
                        } else if (specialMatch) {
                            episodeNumber = specialMatch[1] ? `Special ${specialMatch[1]}` : 'Special';
                        } else if (movieMatch) {
                            episodeNumber = movieMatch[1] ? `Movie ${movieMatch[1]}` : 'Movie';
                        }
                    }
                    
                    const episode = {
                        episode_number: episodeNumber,
                        slug: episodeSlug,
                        title: episodeTitle,
                        release_date: releaseDate
                    };
                    anime.episode_lists.push(episode);
                }
            });
        });
        
        // Check for batch download - look for batch link in any episodelist section
        let batchLink = null;
        $('.episodelist').each((idx, episodeSection) => {
            const $section = $(episodeSection);
            const sectionTitle = $section.find('.smokelister .monktit').text().trim();
            
            if (sectionTitle.toLowerCase().includes('batch')) {
                const $batchLinkEl = $section.find('ul li a').first();
                if ($batchLinkEl.length > 0) {
                    batchLink = $batchLinkEl.attr('href');
                    return false; // break the loop
                }
            }
        });
        
        if (batchLink) {
            // Extract batch slug from href  
            let batchSlug = '';
            const batchSlugMatch = batchLink.match(/\/batch\/([^\/]+)/);
            batchSlug = batchSlugMatch ? batchSlugMatch[1] : '';
            
            anime.batch = {
                slug: batchSlug
            };
        }
        
        return {
            status: 'success',
            data: anime
        };
    } catch (error) {
        console.error('Error scraping anime detail:', error.message);
        throw error;
    }
}

// Scrape Search
async function scrapeSearch(keyword) {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(keyword)}&post_type=anime`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const results = [];
        
        $('.chivsrc li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('h2 a');
            const $img = $el.find('img');
            
            const anime = {
                title: $link.text().trim(),
                slug: extractSlug($link.attr('href')),
                poster: proxyImageUrl($img.attr('src')),
                genres: [],
                status: $el.find('.set:contains("Status")').find('b').text().trim(),
                rating: $el.find('.set:contains("Rating")').find('b').text().trim()
            };
            
            // Parse genres
            $el.find('.set:contains("Genres")').find('a').each((j, genreEl) => {
                anime.genres.push({
                    name: $(genreEl).text().trim()
                });
            });
            
            results.push(anime);
        });
        
        return {
            status: 'success',
            data: results
        };
    } catch (error) {
        console.error('Error scraping search:', error.message);
        throw error;
    }
}

// Scrape Ongoing Anime List with Pagination
async function scrapeOngoingAnime(page = 1) {
    try {
        const url = page === 1 ? `${BASE_URL}/ongoing-anime/` : `${BASE_URL}/ongoing-anime/page/${page}/`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const results = [];
        
        $('.venz ul li').each((i, el) => {
            const $el = $(el);
            const $thumb = $el.find('.thumb a');
            const $img = $el.find('.thumbz img');
            
            // Extract episode number - remove "Episode " text and dashicon
            let episodeText = $el.find('.epz').text().trim();
            episodeText = episodeText.replace(/Episode\s*/i, '').replace(/\s+/g, ' ').trim();
            
            // Extract release day - remove icon and clean text
            let releaseDayText = $el.find('.epztipe').text().trim();
            releaseDayText = releaseDayText.replace(/\s+/g, ' ').trim();
            
            const anime = {
                title: $el.find('.jdlflm').text().trim(),
                slug: extractSlug($thumb.attr('href')),
                poster: proxyImageUrl($img.attr('src')),
                current_episode: episodeText,
                release_day: releaseDayText,
                release_date: $el.find('.newnime').text().trim()
            };
            
            results.push(anime);
        });
        
        // Parse Pagination
        const pagination = {
            current_page: page,
            has_next_page: false,
            has_previous_page: page > 1,
            next_page: page + 1,
            previous_page: page - 1,
            last_visible_page: page
        };
        
        // Find current page and last page from pagination
        const $currentPage = $('.pagination .pagenavix .page-numbers.current');
        if ($currentPage.length > 0) {
            pagination.current_page = parseInt($currentPage.text()) || page;
        }
        
        // Check if "Next" button exists
        const $nextBtn = $('.pagination .pagenavix .next.page-numbers');
        if ($nextBtn.length > 0) {
            pagination.has_next_page = true;
        }
        
        // Find last page number
        let lastPage = page;
        $('.pagination .pagenavix .page-numbers').each((i, el) => {
            const pageText = $(el).text().trim();
            const pageNum = parseInt(pageText);
            if (!isNaN(pageNum) && pageNum > lastPage) {
                lastPage = pageNum;
            }
        });
        pagination.last_visible_page = lastPage;
        
        return {
            status: 'success',
            data: {
                ongoingAnimeData: results,
                paginationData: pagination
            }
        };
    } catch (error) {
        console.error('Error scraping ongoing:', error.message);
        throw error;
    }
}

// Scrape Complete Anime List with Pagination
async function scrapeCompleteAnime(page = 1) {
    try {
        const url = page === 1 ? `${BASE_URL}/complete-anime/` : `${BASE_URL}/complete-anime/page/${page}/`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const results = [];
        
        $('.venz ul li').each((i, el) => {
            const $el = $(el);
            const $thumb = $el.find('.thumb a');
            const $img = $el.find('.thumbz img');
            
            // Extract episode count - remove "Episode" text and dashicon
            let episodeText = $el.find('.epz').text().trim();
            episodeText = episodeText.replace(/Episode\s*/i, '').replace(/\s+/g, ' ').trim();
            
            // Extract rating - remove icon and clean text
            let ratingText = $el.find('.epztipe').text().trim();
            ratingText = ratingText.replace(/\s+/g, ' ').trim();
            
            const anime = {
                title: $el.find('.jdlflm').text().trim(),
                slug: extractSlug($thumb.attr('href')),
                poster: proxyImageUrl($img.attr('src')),
                episode_count: episodeText,
                rating: ratingText,
                release_date: $el.find('.newnime').text().trim()
            };
            
            results.push(anime);
        });
        
        // Parse Pagination
        const pagination = {
            current_page: page,
            has_next_page: false,
            has_previous_page: page > 1,
            next_page: page + 1,
            previous_page: page - 1,
            last_visible_page: page
        };
        
        // Find current page and last page from pagination
        const $currentPage = $('.pagination .pagenavix .page-numbers.current');
        if ($currentPage.length > 0) {
            pagination.current_page = parseInt($currentPage.text()) || page;
        }
        
        // Check if "Next" button exists
        const $nextBtn = $('.pagination .pagenavix .next.page-numbers');
        if ($nextBtn.length > 0) {
            pagination.has_next_page = true;
        }
        
        // Find last page number
        let lastPage = page;
        $('.pagination .pagenavix .page-numbers').each((i, el) => {
            const pageText = $(el).text().trim();
            const pageNum = parseInt(pageText);
            if (!isNaN(pageNum) && pageNum > lastPage) {
                lastPage = pageNum;
            }
        });
        pagination.last_visible_page = lastPage;
        
        return {
            status: 'success',
            data: {
                completedAnimeData: results,
                paginationData: pagination
            }
        };
    } catch (error) {
        console.error('Error scraping complete anime:', error.message);
        throw error;
    }
}

// Scrape Anime by Genre with Pagination
async function scrapeGenreAnime(genreSlug, page = 1) {
    try {
        const url = page === 1 
            ? `${BASE_URL}/genres/${genreSlug}/` 
            : `${BASE_URL}/genres/${genreSlug}/page/${page}/`;
        
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const results = [];
        
        // Parse each anime
        $('.col-anime-con').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('.col-anime-title a');
            const $img = $el.find('.col-anime-cover img');
            
            const genres = [];
            $el.find('.col-anime-genre a').each((j, genreEl) => {
                genres.push({
                    name: $(genreEl).text().trim()
                });
            });
            
            const anime = {
                title: $link.text().trim(),
                slug: extractSlug($link.attr('href')),
                poster: proxyImageUrl($img.attr('src')),
                studio: $el.find('.col-anime-studio').text().trim(),
                episode_count: $el.find('.col-anime-eps').text().trim(),
                rating: $el.find('.col-anime-rating').text().trim(),
                genres: genres,
                synopsis: $el.find('.col-synopsis p').text().trim(),
                release_date: $el.find('.col-anime-date').text().trim()
            };
            
            results.push(anime);
        });
        
        // Parse Pagination
        const pagination = {
            current_page: page,
            has_next_page: false,
            has_previous_page: page > 1,
            next_page: page + 1,
            previous_page: page - 1,
            last_visible_page: page
        };
        
        // Find current page and last page from pagination
        const $currentPage = $('.pagination .pagenavix .page-numbers.current');
        if ($currentPage.length > 0) {
            pagination.current_page = parseInt($currentPage.text()) || page;
        }
        
        // Check if "Next" button exists
        const $nextBtn = $('.pagination .pagenavix .next.page-numbers');
        if ($nextBtn.length > 0) {
            pagination.has_next_page = true;
        }
        
        // Find last page number
        let lastPage = page;
        $('.pagination .pagenavix .page-numbers').each((i, el) => {
            const pageText = $(el).text().trim();
            const pageNum = parseInt(pageText);
            if (!isNaN(pageNum) && pageNum > lastPage) {
                lastPage = pageNum;
            }
        });
        pagination.last_visible_page = lastPage;
        
        return {
            status: 'success',
            data: {
                genreAnimeData: results,
                paginationData: pagination
            }
        };
    } catch (error) {
        console.error('Error scraping genre anime:', error.message);
        throw error;
    }
}

// Scrape Genre List
async function scrapeGenreList() {
    try {
        const url = `${BASE_URL}/genre-list/`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const genres = [];
        
        // Parse genres from the list
        $('.genres li a').each((i, el) => {
            const $link = $(el);
            const href = $link.attr('href');
            const name = $link.text().trim();
            
            // Extract slug from href (/genres/action/ -> action)
            const slugMatch = href ? href.match(/\/genres\/([^\/]+)/) : null;
            const slug = slugMatch ? slugMatch[1] : '';
            
            if (name && slug) {
                genres.push({
                    name: name,
                    slug: slug
                });
            }
        });
        
        return {
            status: 'success',
            data: genres
        };
    } catch (error) {
        console.error('Error scraping genre list:', error.message);
        throw error;
    }
}

// Scrape All Anime List (Alphabetically organized)
async function scrapeAllAnime() {
    try {
        const url = `${BASE_URL}/anime-list/`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const result = [];
        
        // Parse each alphabetical section
        $('.bariskelom').each((i, section) => {
            const $section = $(section);
            
            // Get the letter/number header
            const letter = $section.find('.barispenz a').attr('name') || '';
            
            // Parse anime items in this section
            const animeList = [];
            $section.find('.jdlbar ul li').each((j, el) => {
                const $link = $(el).find('a.hodebgst');
                const href = $link.attr('href');
                const title = $link.attr('title') || $link.text().trim();
                
                // Clean title - remove extra text like "(Episode 1-12) Subtitle Indonesia"
                let cleanTitle = title.replace(/\s*\(Episode.*?\)\s*Subtitle Indonesia/i, '').trim();
                cleanTitle = cleanTitle.replace(/\s*BD\s*$/i, '').trim();
                
                if (href && cleanTitle) {
                    animeList.push({
                        title: cleanTitle,
                        slug: extractSlug(href)
                    });
                }
            });
            
            // Only add section if it has anime items
            if (letter && animeList.length > 0) {
                result.push({
                    letter: letter,
                    anime: animeList
                });
            }
        });
        
        return {
            status: 'success',
            data: result
        };
    } catch (error) {
        console.error('Error scraping all anime:', error.message);
        throw error;
    }
}

// Scrape Episode Detail
async function scrapeEpisode(episodeSlug) {
    try {
        const url = `${BASE_URL}/episode/${episodeSlug}/`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        
        const episode = {
            title: $('.posttl').text().trim(),
            slug: episodeSlug,
            post_id: null,
            anime_title: '',
            episode_number: '',
            default_stream_url: '',
            streaming_mirrors: {
                '360p': [],
                '480p': [],
                '720p': []
            },
            download_links: [],
            prev_episode: null,
            next_episode: null,
            episode_list: [],
            anime_detail_url: '',
            poster: proxyImageUrl($('.cukder img').attr('src')),
            genres: [],
            duration: '',
            type: ''
        };
        
        // Extract post ID from shortlink meta tag
        const shortlink = $('link[rel="shortlink"]').attr('href');
        if (shortlink) {
            const postIdMatch = shortlink.match(/p=(\d+)/);
            if (postIdMatch) {
                episode.post_id = postIdMatch[1];
            }
        }
        
        // Extract episode number and anime title from title
        const titleMatch = episode.title.match(/^(.+?)\s+Episode\s+(\d+)/i);
        if (titleMatch) {
            episode.anime_title = titleMatch[1].trim();
            episode.episode_number = titleMatch[2];
        }
        
        // Extract default iframe URL from the embed player
        const defaultIframe = $('#pembed iframe').attr('src');
        if (defaultIframe) {
            episode.default_stream_url = defaultIframe;
        }
        
        // Parse streaming mirrors
        $('.mirrorstream ul').each((idx, ul) => {
            const $ul = $(ul);
            const quality = $ul.attr('class'); // m360p, m480p, m720p
            let qualityLabel = '';
            
            if (quality && quality.includes('360p')) qualityLabel = '360p';
            else if (quality && quality.includes('480p')) qualityLabel = '480p';
            else if (quality && quality.includes('720p')) qualityLabel = '720p';
            
            if (qualityLabel) {
                $ul.find('li a').each((i, el) => {
                    const $link = $(el);
                    const server = $link.text().trim();
                    const dataContent = $link.attr('data-content');
                    
                    if (server && dataContent) {
                        episode.streaming_mirrors[qualityLabel].push({
                            server: server,
                            data_content: dataContent
                        });
                    }
                });
            }
        });
        
        // Parse download links
        $('.download ul').each((idx, ul) => {
            const $ul = $(ul);
            
            $ul.find('li').each((i, li) => {
                const $li = $(li);
                const quality = $li.find('strong').text().trim();
                const size = $li.find('i').text().trim();
                const links = [];
                
                $li.find('a').each((j, a) => {
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
        });
        
        // Parse prev/next episode
        $('.prevnext .flir a').each((i, el) => {
            const $link = $(el);
            const href = $link.attr('href');
            const text = $link.text().trim().toLowerCase();
            
            if (text.includes('see all') || text.includes('episodes')) {
                episode.anime_detail_url = href;
            } else if (text.includes('prev') || text.includes('sebelum')) {
                const prevSlugMatch = href ? href.match(/\/episode\/([^\/]+)/) : null;
                episode.prev_episode = prevSlugMatch ? prevSlugMatch[1] : '';
            } else if (text.includes('next') || text.includes('selanjutnya')) {
                const nextSlugMatch = href ? href.match(/\/episode\/([^\/]+)/) : null;
                episode.next_episode = nextSlugMatch ? nextSlugMatch[1] : '';
            }
        });
        
        // Parse episode list from selector
        $('#selectcog option').each((i, option) => {
            const $option = $(option);
            const value = $option.attr('value');
            const text = $option.text().trim();
            
            if (value && value !== '0' && !text.includes('Pilih')) {
                const episodeSlugMatch = value.match(/\/episode\/([^\/]+)/);
                const episodeNumMatch = text.match(/Episode\s+(\d+)/i);
                
                if (episodeSlugMatch) {
                    episode.episode_list.push({
                        episode_number: episodeNumMatch ? episodeNumMatch[1] : '',
                        slug: episodeSlugMatch[1],
                        title: text,
                        url: value
                    });
                }
            }
        });
        
        // Parse anime info (genres, duration, type)
        $('.cukder .infozingle p').each((i, p) => {
            const $p = $(p);
            const text = $p.text();
            
            if (text.includes('Genres')) {
                $p.find('a').each((j, a) => {
                    const $a = $(a);
                    const href = $a.attr('href');
                    const name = $a.text().trim();
                    
                    if (name && href) {
                        const slugMatch = href.match(/\/genres\/([^\/]+)/);
                        episode.genres.push({
                            name: name,
                            slug: slugMatch ? slugMatch[1] : ''
                        });
                    }
                });
            } else if (text.includes('Duration')) {
                const durationMatch = text.match(/:\s*(.+)/);
                episode.duration = durationMatch ? durationMatch[1].trim() : '';
            } else if (text.includes('Tipe')) {
                const typeMatch = text.match(/:\s*(.+)/);
                episode.type = typeMatch ? typeMatch[1].trim() : '';
            }
        });
        
        return {
            status: 'success',
            data: episode
        };
    } catch (error) {
        console.error('Error scraping episode:', error.message);
        throw error;
    }
}

// Scrape Batch Downloads
async function scrapeBatch(batchSlug) {
    try {
        const url = `${BASE_URL}/batch/${batchSlug}/`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        
        // Helper function to extract info value
        const extractInfoValue = (text) => {
            if (!text) return '';
            const parts = text.split(':');
            return parts.length > 1 ? parts.slice(1).join(':').trim() : text.trim();
        };
        
        // Parse anime info
        const batch = {
            title: '',
            japanese_title: '',
            poster: '',
            type: '',
            total_episodes: '',
            rating: '',
            genres: [],
            duration: '',
            studio: '',
            producers: '',
            aired: '',
            credit: '',
            synopsis: '',
            anime_detail_url: '',
            download_list: []
        };
        
        // Extract title from h1
        const titleText = $('.jdlrx h1').text().trim();
        batch.title = titleText.replace('[BATCH] Subtitle Indonesia', '').trim();
        
        // Parse info using HTML string with regex
        const infosHtml = $('.animeinfo .infos').html();
        
        // Extract each field using regex on HTML
        const judulMatch = infosHtml.match(/<b>Judul<\/b>\s*:\s*([^<]+)/);
        if (judulMatch) batch.title = judulMatch[1].trim();
        
        const japaneseMatch = infosHtml.match(/<b>Japanese<\/b>\s*:\s*([^<]+)/);
        if (japaneseMatch) batch.japanese_title = japaneseMatch[1].trim();
        
        const typeMatch = infosHtml.match(/<b>Type<\/b>\s*:\s*([^<]+)/);
        if (typeMatch) batch.type = typeMatch[1].trim();
        
        const episodesMatch = infosHtml.match(/<b>Episodes<\/b>\s*:\s*([^<]+)/);
        if (episodesMatch) batch.total_episodes = episodesMatch[1].trim();
        
        const ratingMatch = infosHtml.match(/<b>Rating<\/b>\s*:\s*([^<]+)/);
        if (ratingMatch) batch.rating = ratingMatch[1].trim();
        
        const durationMatch = infosHtml.match(/<b>Duration<\/b>\s*:\s*([^<]+)/);
        if (durationMatch) batch.duration = durationMatch[1].trim();
        
        const studiosMatch = infosHtml.match(/<b>Studios<\/b>\s*:\s*([^<]+)/);
        if (studiosMatch) batch.studio = studiosMatch[1].trim();
        
        const producersMatch = infosHtml.match(/<b>Producers<\/b>\s*:\s*([^<]+)/);
        if (producersMatch) batch.producers = producersMatch[1].trim();
        
        const airedMatch = infosHtml.match(/<b>Aired<\/b>\s*:\s*([^<]+)/);
        if (airedMatch) batch.aired = airedMatch[1].trim();
        
        const creditMatch = infosHtml.match(/<b>Credit<\/b>\s*:\s*([^<]+)/);
        if (creditMatch) batch.credit = creditMatch[1].trim();
        
        // Extract genres separately
        $('.animeinfo .infos a[href*="/genres/"]').each((i, el) => {
            const $el = $(el);
            const genreUrl = $el.attr('href');
            const genreName = $el.text().trim();
            const genreMatch = genreUrl ? genreUrl.match(/\/genres\/([^\/]+)/) : null;
            batch.genres.push({
                name: genreName,
                slug: genreMatch ? genreMatch[1] : ''
            });
        });
        
        // Extract poster
        const posterImg = $('.animeinfo .imganime img').attr('src');
        if (posterImg) {
            batch.poster = proxyImageUrl(posterImg);
        }
        
        // Extract synopsis
        batch.synopsis = $('.animeinfo .deskripsi').text().replace('Sinopsis:', '').trim();
        
        // Extract total episodes from .totalepisode
        const totalEps = $('.totalepisode .total').text().trim();
        if (totalEps) {
            batch.total_episodes = totalEps;
        }
        
        // Extract anime detail URL
        const detailLink = $('.totalepisode h3 a').attr('href');
        if (detailLink) {
            batch.anime_detail_url = detailLink;
        }
        
        // Parse download links
        $('.download2 .batchlink ul li').each((i, el) => {
            const $el = $(el);
            const quality = $el.find('strong').text().trim();
            const size = $el.find('i').text().trim();
            
            const links = [];
            $el.find('a').each((idx, linkEl) => {
                const $link = $(linkEl);
                links.push({
                    host: $link.text().trim(),
                    url: $link.attr('href')
                });
            });
            
            if (quality && links.length > 0) {
                batch.download_list.push({
                    quality: quality,
                    size: size,
                    links: links
                });
            }
        });
        
        return {
            status: 'success',
            data: batch
        };
    } catch (error) {
        console.error('Error scraping batch:', error.message);
        throw error;
    }
}

// Scrape Schedule
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
                
                // Extract slug from href
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
        console.error('Error scraping schedule:', error.message);
        throw error;
    }
}

// Extract slug from URL
function extractSlug(url) {
    if (!url) return '';
    const match = url.match(/\/anime\/([^\/]+)/);
    return match ? match[1] : '';
}

module.exports = {
    scrapeHome,
    scrapeAnimeDetail,
    scrapeSearch,
    scrapeOngoingAnime,
    scrapeCompleteAnime,
    scrapeAllAnime,
    scrapeGenreList,
    scrapeGenreAnime,
    scrapeEpisode,
    scrapeBatch,
    scrapeSchedule,
    getImageUrlMap
};
