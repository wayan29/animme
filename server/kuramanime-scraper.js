const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const puppeteer = require('puppeteer');

const BASE_URL = 'https://v8.kuramanime.tel';

// Helper function to extract streaming URLs from specific server
async function extractStreamingUrlsForServer(url, authToken, pageTokenKey, serverKey, serverName) {
    try {
        const videoPageUrl = `${url}?${pageTokenKey}=${authToken}&${serverKey}=${serverName}&page=1`;
        
        const videoResponse = await axios.get(videoPageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': url
            },
            timeout: 10000
        });
        
        const $video = cheerio.load(videoResponse.data);
        const sources = [];
        
        // Try to extract from video sources
        $video('video source').each((i, el) => {
            const src = $video(el).attr('src');
            const quality = $video(el).attr('size');
            const type = $video(el).attr('type');
            
            if (src) {
                sources.push({
                    quality: quality ? `${quality}p` : 'unknown',
                    type: type || 'video/mp4',
                    url: src
                });
            }
        });
        
        // If no sources, try to extract iframe
        if (sources.length === 0) {
            const iframe = $video('iframe').first().attr('src');
            if (iframe) {
                sources.push({
                    quality: 'iframe',
                    type: 'text/html',
                    url: iframe
                });
            }
        }
        
        return sources;
    } catch (error) {
        console.warn(`Failed to extract from ${serverName}:`, error.message);
        return [];
    }
}

// Helper function to extract streaming URLs from all servers
async function extractStreamingUrls(page, url, animeId, slug, episodeNum) {
    try {
        const html = await page.content();
        const $ = cheerio.load(html);
        
        // Step 1: Extract data-kk attribute
        const dataKk = $('[data-kk]').attr('data-kk');
        if (!dataKk) {
            console.warn('data-kk attribute not found');
            return null;
        }
        
        console.log(`Found data-kk: ${dataKk}`);
        
        // Step 2: Fetch JS file to get environment variables
        const jsUrl = `${BASE_URL}/assets/js/${dataKk}.js`;
        const jsResponse = await axios.get(jsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': url
            }
        });
        
        // Step 3: Parse environment variables from JS
        const jsContent = jsResponse.data;
        const envMatch = jsContent.match(/window\.process\s*=\s*{\s*env:\s*({[^}]+})/);
        if (!envMatch) {
            console.warn('Could not parse environment variables from JS');
            return null;
        }
        
        // Extract env variables
        const envVars = {};
        const envContent = envMatch[1];
        const varMatches = envContent.matchAll(/(\w+):\s*['"]([^'"]+)['"]/g);
        for (const match of varMatches) {
            envVars[match[1]] = match[2];
        }
        
        console.log('Parsed env vars:', Object.keys(envVars));
        
        // Step 4: Fetch auth token
        const authTokenUrl = `${BASE_URL}/${envVars.MIX_PREFIX_AUTH_ROUTE_PARAM || 'assets/'}${envVars.MIX_AUTH_ROUTE_PARAM}`;
        const tokenResponse = await axios.get(authTokenUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': url
            }
        });
        
        const authToken = tokenResponse.data.trim();
        console.log('Auth token obtained');
        
        // Step 5: Extract from all available servers
        const pageTokenKey = envVars.MIX_PAGE_TOKEN_KEY;
        const serverKey = envVars.MIX_STREAM_SERVER_KEY;
        
        const servers = ['kuramadrive', 'filemoon', 'mega', 'rpmshare', 'streamwish', 'vidguard'];
        const serverResults = {};
        
        console.log('Extracting video sources from all servers...');
        
        // Extract from all servers in parallel
        const extractPromises = servers.map(async (serverName) => {
            const sources = await extractStreamingUrlsForServer(
                url, authToken, pageTokenKey, serverKey, serverName
            );
            return { serverName, sources };
        });
        
        const results = await Promise.all(extractPromises);
        
        // Organize results by server
        results.forEach(({ serverName, sources }) => {
            if (sources.length > 0) {
                serverResults[serverName] = sources;
                console.log(`  ✓ ${serverName}: ${sources.length} source(s)`);
            } else {
                console.log(`  ✗ ${serverName}: no sources`);
            }
        });
        
        return {
            servers: serverResults,
            default_server: 'kuramadrive',
            auth_info: {
                data_kk: dataKk,
                page_token_key: pageTokenKey,
                server_key: serverKey
            }
        };
        
    } catch (error) {
        console.error('Error extracting streaming URLs:', error.message);
        console.error('Stack:', error.stack);
        return null;
    }
}

function getImageHash(url) {
    return crypto.createHash('md5').update(url).digest('hex');
}

const imageUrlMap = new Map();

function proxyImageUrl(url) {
    if (!url || !url.startsWith('http')) return url;
    const hash = getImageHash(url);
    imageUrlMap.set(hash, url);
    return `/img/${hash}`;
}

function getImageUrlMap() {
    return imageUrlMap;
}

function extractSlug(url) {
    if (!url) return '';
    const match = url.match(/\/anime\/(\d+)\/([^\/]+)/);
    return match ? match[2] : '';
}

function extractAnimeId(url) {
    if (!url) return '';
    const match = url.match(/\/anime\/(\d+)\//);
    return match ? match[1] : '';
}

async function scrapeHome() {
    try {
        const { data } = await axios.get(BASE_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const result = {
            banner_rekomendasi: [],
            sedang_tayang: [],
            dilihat_terbanyak_musim_ini: [],
            komentar_terbaru_episode: [],
            selesai_tayang: [],
            film_layar_lebar: [],
            komentar_terbaru_anime: []
        };
        
        // 1. Banner Rekomendasi (8 items from hero slider)
        $('#sliderSection .hero__items').each((i, el) => {
            if (i >= 8) return false;
            const $el = $(el);
            const $heroText = $el.find('.hero__text');
            const title = $heroText.find('h2').text().trim();
            const description = $heroText.find('p').text().trim();
            const detailLink = $heroText.find('a[href*="/anime/"]').attr('href');
            const backgroundImage = $el.attr('data-setbg');
            
            const genres = [];
            $heroText.find('.label').each((j, genreEl) => {
                genres.push($(genreEl).text().trim());
            });
            
            if (title && detailLink) {
                result.banner_rekomendasi.push({
                    title: title,
                    description: description,
                    slug: extractSlug(detailLink),
                    anime_id: extractAnimeId(detailLink),
                    poster: proxyImageUrl(backgroundImage),
                    genres: genres,
                    url: detailLink.startsWith('http') ? detailLink : `${BASE_URL}${detailLink}`
                });
            }
        });
        
        // 2-4. Parse all trending sections: Sedang Tayang, Selesai Tayang, Film Layar Lebar
        $('.trending__product').each((sectionIdx, section) => {
            const $section = $(section);
            const sectionTitle = $section.find('.section-title h4, .section-title h5').first().text().trim();
            
            let targetArray = null;
            if (sectionTitle === 'Sedang Tayang') {
                targetArray = result.sedang_tayang;
            } else if (sectionTitle === 'Selesai Tayang') {
                targetArray = result.selesai_tayang;
            } else if (sectionTitle === 'Film Layar Lebar') {
                targetArray = result.film_layar_lebar;
            }
            
            if (targetArray) {
                $section.find('.product__item').each((i, el) => {
                    const $el = $(el);
                    const $link = $el.find('a').first();
                    const href = $link.attr('href');
                    const title = $el.find('h5 a, .product__item__text h5 a').first().text().trim();
                    const poster = $el.find('.product__item__pic').attr('data-setbg');
                    const episodeInfo = $el.find('.ep span').text().trim() || $el.find('.ep').text().trim();
                    
                    // Extract type and quality from ul li tags
                    const types = [];
                    $el.find('.product__item__text ul li').each((j, liEl) => {
                        const typeText = $(liEl).text().trim();
                        if (typeText) types.push(typeText);
                    });
                    
                    // Extract views and comments (may be loading placeholders)
                    const viewsText = $el.find('.fa-eye').next('span').text().trim();
                    const commentsText = $el.find('.fa-comments').next('span').text().trim();
                    
                    if (title && href) {
                        targetArray.push({
                            title: title,
                            slug: extractSlug(href),
                            anime_id: extractAnimeId(href),
                            poster: proxyImageUrl(poster),
                            episode: episodeInfo,
                            type: types.length > 0 ? types.join(' ') : null,
                            views: viewsText && !viewsText.includes('Loading') ? viewsText : null,
                            comments: commentsText && !commentsText.includes('Loading') ? commentsText : null,
                            url: href.startsWith('http') ? href : `${BASE_URL}${href}`
                        });
                    }
                });
            }
        });
        
        // 5. Dilihat Terbanyak Musim Ini (Most Viewed This Season)
        $('.product__sidebar__view').each((i, sidebar) => {
            const $sidebar = $(sidebar);
            const sidebarTitle = $sidebar.find('h5, h4').first().text().trim();
            
            if (sidebarTitle.includes('Dilihat Terbanyak')) {
                $sidebar.find('.product__sidebar__view__item').each((j, el) => {
                    const $el = $(el);
                    const $link = $el.closest('a').length > 0 ? $el.closest('a') : $el.find('a');
                    const href = $link.attr('href');
                    const title = $el.find('h5').text().trim();
                    
                    // Poster is on the parent <a> tag, not inside the item
                    const poster = $el.parent().attr('data-setbg') || $el.parent().find('[data-setbg]').first().attr('data-setbg');
                    
                    // In "Most Viewed" sidebar, .ep contains rating, .view contains views
                    const rating = $el.find('.ep').text().trim();
                    const viewsText = $el.find('.view').text().trim();
                    
                    if (title && href) {
                        result.dilihat_terbanyak_musim_ini.push({
                            title: title,
                            slug: extractSlug(href),
                            anime_id: extractAnimeId(href),
                            poster: proxyImageUrl(poster),
                            rating: rating || null,
                            views: viewsText && !viewsText.includes('Loading') ? viewsText : null,
                            url: href.startsWith('http') ? href : `${BASE_URL}${href}`
                        });
                    }
                });
            }
        });
        
        // 6. Komentar Terbaru - Episode & Anime
        // Note: Comment sections use .product__sidebar__view structure (not .product__sidebar__comment)
        $('.product__sidebar__view').each((sectionIdx, sidebar) => {
            const $sidebar = $(sidebar);
            const sidebarTitle = $sidebar.find('.section-title h5, .section-title h4, h5, h4').first().text().trim();
            
            if (sidebarTitle.includes('Komentar')) {
                const isEpisode = sidebarTitle.includes('Episode');
                const targetArray = isEpisode ? result.komentar_terbaru_episode : result.komentar_terbaru_anime;
                
                $sidebar.find('.product__sidebar__comment__item').each((i, el) => {
                    const $el = $(el);
                    const $link = $el.find('a').first();
                    const href = $link.attr('href');
                    const poster = $el.find('.product__sidebar__comment__item__pic').attr('data-setbg');
                    const title = $el.find('h5, a h5').first().text().trim();
                    
                    // Extract episode info and user from span text
                    const infoText = $el.find('span').text().trim();
                    const episodeMatch = infoText.match(/Episode (\d+)/);
                    const userMatch = infoText.match(/oleh (.+?)\)/);
                    const timeMatch = infoText.match(/Dikomentari\s+(.+?)\s+oleh/);
                    
                    const episodeInfo = episodeMatch ? `Episode ${episodeMatch[1]}` : '';
                    const username = userMatch ? userMatch[1].trim() : '';
                    const timeAgo = timeMatch ? timeMatch[1].trim() : '';
                    
                    if (title && href) {
                        const item = {
                            title: title,
                            username: username,
                            time_ago: timeAgo,
                            poster: proxyImageUrl(poster),
                            url: href.startsWith('http') ? href : `${BASE_URL}${href}`
                        };
                        
                        if (isEpisode && episodeInfo) {
                            item.episode_info = episodeInfo;
                        }
                        
                        targetArray.push(item);
                    }
                });
            }
        });
        
        return result;
    } catch (error) {
        console.error('Kuramanime scrapeHome error:', error.message);
        throw error;
    }
}

async function scrapeDetail(animeId, slug) {
    try {
        const url = `${BASE_URL}/anime/${animeId}/${slug}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const result = {
            title: '',
            alternative_titles: [],
            poster: '',
            synopsis: '',
            info: {},
            genres: [],
            episodes: [],
            batch_list: [],
            anime_lainnya: []
        };
        
        result.title = $('.anime__details__title h3').text().trim();
        result.poster = proxyImageUrl($('.anime__details__pic').attr('data-setbg'));
        result.synopsis = $('.anime__details__text p').text().trim();
        
        $('.anime__details__widget ul li').each((i, el) => {
            const $el = $(el);
            const label = $el.find('.col-3 span').text().trim().replace(':', '');
            
            // Value is in .col-9, either in <a> tag or direct text
            const $valueCol = $el.find('.col-9');
            let value = $valueCol.find('a').text().trim();
            if (!value) {
                value = $valueCol.text().trim();
            }
            
            if (label && value) {
                result.info[label.toLowerCase().replace(/\s+/g, '_')] = value;
            }
        });
        
        $('.anime__details__widget .row .col-lg-6:last-child li').each((i, el) => {
            const $el = $(el);
            $el.find('a').each((j, genreEl) => {
                result.genres.push($(genreEl).text().trim());
            });
        });
        
        // Episodes are in the popover content of #episodeLists button
        const $episodeBtn = $('#episodeLists');
        if ($episodeBtn.length > 0) {
            const popoverContent = $episodeBtn.attr('data-content');
            if (popoverContent) {
                const $popover = cheerio.load(popoverContent);
                $popover('a[href*="/episode/"]').each((i, el) => {
                    const $el = $popover(el);
                    const episodeHref = $el.attr('href');
                    const episodeTitle = $el.text().trim();
                    
                    if (episodeHref && episodeTitle) {
                        result.episodes.push({
                            title: episodeTitle,
                            url: episodeHref.startsWith('http') ? episodeHref : `${BASE_URL}${episodeHref}`
                        });
                    }
                });
            }
        }
        
        // Fallback: Check for .anime__details__episodes (older structure)
        if (result.episodes.length === 0) {
            $('.anime__details__episodes a').each((i, el) => {
                const $el = $(el);
                const episodeHref = $el.attr('href');
                const episodeTitle = $el.text().trim();
                
                if (episodeHref && episodeTitle) {
                    result.episodes.push({
                        title: episodeTitle,
                        url: episodeHref.startsWith('http') ? episodeHref : `${BASE_URL}${episodeHref}`
                    });
                }
            });
        }
        
        // Batch downloads from popover (for completed anime)
        const $batchBtn = $('#episodeBatchLists');
        if ($batchBtn.length > 0) {
            const batchPopoverContent = $batchBtn.attr('data-content');
            if (batchPopoverContent) {
                const $batchPopover = cheerio.load(batchPopoverContent);
                $batchPopover('a[href*="/batch/"]').each((i, el) => {
                    const $el = $batchPopover(el);
                    const batchHref = $el.attr('href');
                    const batchTitle = $el.text().trim().replace(/\s+/g, ' ');
                    
                    if (batchHref && batchTitle) {
                        // Extract batch range from URL (e.g., "1-12" from ".../batch/1-12")
                        const batchRangeMatch = batchHref.match(/\/batch\/([^\/]+)$/);
                        const batchRange = batchRangeMatch ? batchRangeMatch[1] : '';
                        
                        result.batch_list.push({
                            title: batchTitle,
                            range: batchRange,
                            url: batchHref.startsWith('http') ? batchHref : `${BASE_URL}${batchHref}`
                        });
                    }
                });
            }
        }
        
        // Anime Lainnya (Related/Recommended Anime)
        $('.anime__details__sidebar').each((i, sidebar) => {
            const $sidebar = $(sidebar);
            const sectionTitle = $sidebar.find('.section-title h5, .section-title h4').text().trim();
            
            if (sectionTitle === 'Anime Lainnya') {
                $sidebar.find('#randomList a[href*="/anime/"]').each((j, el) => {
                    const $link = $(el);
                    const href = $link.attr('href');
                    
                    const $item = $link.find('.product__sidebar__view__item');
                    const poster = $item.attr('data-setbg');
                    const title = $item.find('h5').text().trim();
                    const rating = $item.find('.ep').text().trim().replace(/\s+/g, ' ');
                    const quality = $item.find('.view').text().trim();
                    
                    if (title && href) {
                        result.anime_lainnya.push({
                            title: title,
                            slug: extractSlug(href),
                            anime_id: extractAnimeId(href),
                            poster: proxyImageUrl(poster),
                            rating: rating || null,
                            quality: quality || null,
                            url: href.startsWith('http') ? href : `${BASE_URL}${href}`
                        });
                    }
                });
            }
        });
        
        return result;
    } catch (error) {
        console.error('Kuramanime scrapeDetail error:', error.message);
        throw error;
    }
}

async function scrapeEpisode(animeId, slug, episodeNum) {
    let browser;
    try {
        const url = `${BASE_URL}/anime/${animeId}/${slug}/episode/${episodeNum}`;
        
        // Use Puppeteer to handle dynamic content
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: '/snap/bin/chromium',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        await page.goto(url, { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        // Wait for download links to load (up to 15 seconds)
        try {
            await page.waitForFunction(
                () => {
                    const downloadSection = document.querySelector('#animeDownloadLink');
                    if (!downloadSection) return false;
                    const links = downloadSection.querySelectorAll('a[href]');
                    return links.length > 0;
                },
                { timeout: 15000 }
            );
        } catch (waitError) {
            console.warn('Download links did not load within timeout');
        }
        
        const data = await page.content();
        
        // Extract video streaming URLs before closing browser
        const videoSources = await extractStreamingUrls(page, url, animeId, slug, episodeNum);
        
        await browser.close();
        browser = null;
        
        const $ = cheerio.load(data);
        const result = {
            title: '',
            anime_title: '',
            episode: episodeNum,
            anime_detail_url: '',
            episode_list: [],
            current_server: '',
            streaming_servers: [],
            download_links: [],
            navigation: {
                prev_episode: null,
                next_episode: null
            }
        };
        
        result.anime_title = $('.breadcrumb__links a[href*="/anime/"]').last().text().trim();
        
        const episodeTitleFull = $('#episodeTitle').text().trim();
        result.title = episodeTitleFull || $('.anime__video__player h5').first().text().trim();
        
        // Extract anime detail URL from navigation
        const animeDetailLink = $('.episode__navigations .center__nav').attr('href');
        if (animeDetailLink) {
            result.anime_detail_url = animeDetailLink.startsWith('http') ? animeDetailLink : `${BASE_URL}${animeDetailLink}`;
        }
        
        // Extract episode list
        $('.anime__details__episodes #animeEpisodes a.ep-button').each((i, el) => {
            const $el = $(el);
            const href = $el.attr('href');
            const episodeText = $el.text().trim();
            const isActive = $el.hasClass('active-ep');
            
            // Extract episode number from text (e.g., "Ep 1" -> "1")
            const epMatch = episodeText.match(/Ep\s*(\d+)/i);
            const epNum = epMatch ? epMatch[1] : '';
            
            // Check for special indicators (fire icon = new/hot)
            const hasFireIcon = $el.find('.fa-fire').length > 0;
            
            if (href && episodeText) {
                result.episode_list.push({
                    episode: epNum,
                    title: episodeText,
                    url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
                    is_active: isActive,
                    is_new: hasFireIcon
                });
            }
        });
        
        const currentServerText = $('.anime__video__player h5 .text-danger, h5 .text-danger').first().text().trim();
        result.current_server = currentServerText || 'BGlobal';
        
        // Extract streaming servers first (will add sources later)
        $('#changeServer option').each((i, el) => {
            const $el = $(el);
            const value = $el.attr('value');
            const text = $el.text().trim();
            const isSelected = $el.attr('selected') !== undefined;
            
            if (value && text) {
                result.streaming_servers.push({
                    value: value,
                    name: text,
                    selected: isSelected,
                    sources: [] // Will be filled later
                });
            }
        });
        
        // Extract download links from #animeDownloadLink section
        const $downloadSection = $('#animeDownloadLink');
        if ($downloadSection.length > 0) {
            let currentQuality = '';
            let currentSize = '';
            let currentFormat = '';
            
            $downloadSection.children().each((i, el) => {
                const $el = $(el);
                
                // Check if this is a quality/format header (h6 tag)
                if ($el.is('h6')) {
                    const headerText = $el.text().trim();
                    // Example: "MKV 480p (Softsub) — (112.93 MB)" or "MP4 720p (Hardsub) — (195.02 MB)"
                    
                    // Extract format (MKV, MP4)
                    const formatMatch = headerText.match(/^(MKV|MP4)/i);
                    currentFormat = formatMatch ? formatMatch[1].toUpperCase() : '';
                    
                    // Extract quality (480p, 720p, 1080p, etc.)
                    const qualityMatch = headerText.match(/(\d+p)/i);
                    currentQuality = qualityMatch ? qualityMatch[1] : '';
                    
                    // Extract sub type (Softsub, Hardsub)
                    const subType = headerText.match(/\((Softsub|Hardsub)\)/i);
                    const subTypeStr = subType ? subType[1] : '';
                    
                    // Extract size (112.93 MB, etc.)
                    const sizeMatch = headerText.match(/—\s*\(([^)]+)\)/);
                    currentSize = sizeMatch ? sizeMatch[1].trim() : '';
                    
                    // Build full quality string
                    currentQuality = `${currentFormat} ${currentQuality}${subTypeStr ? ' (' + subTypeStr + ')' : ''}`.trim();
                }
                // Check if this is a download link (a tag)
                else if ($el.is('a')) {
                    const href = $el.attr('href');
                    const linkText = $el.text().trim();
                    
                    if (href && linkText) {
                        result.download_links.push({
                            quality: currentQuality,
                            size: currentSize,
                            provider: linkText,
                            url: href.startsWith('http') ? href : `${BASE_URL}${href}`
                        });
                    }
                }
            });
        }
        
        // Extract navigation links from .episode__navigations
        $('.episode__navigations a').each((i, el) => {
            const $el = $(el);
            const href = $el.attr('href');
            const text = $el.text().trim().toLowerCase();
            
            if (href && href.includes('/episode/')) {
                if (text.includes('sebelumnya') || text.includes('prev') || text.includes('previous')) {
                    result.navigation.prev_episode = href.startsWith('http') ? href : `${BASE_URL}${href}`;
                } else if (text.includes('selanjutnya') || text.includes('next')) {
                    result.navigation.next_episode = href.startsWith('http') ? href : `${BASE_URL}${href}`;
                }
            }
        });
        
        result.iframe_url = null;
        const $iframe = $('iframe#animeVideoPlayer, iframe.anime-player, iframe[src*="kuramadrive"], iframe[src*="filemoon"]').first();
        if ($iframe.length > 0) {
            result.iframe_url = $iframe.attr('src');
        }
        
        // Integrate video sources into streaming_servers
        if (videoSources && videoSources.servers) {
            result.streaming_servers.forEach(server => {
                const serverSources = videoSources.servers[server.value];
                if (serverSources && serverSources.length > 0) {
                    server.sources = serverSources;
                }
            });
        }
        
        return result;
    } catch (error) {
        if (browser) {
            await browser.close();
        }
        console.error('Kuramanime scrapeEpisode error:', error.message);
        throw error;
    }
}

async function scrapeSearch(query, page = 1, orderBy = 'ascending') {
    try {
        const url = `${BASE_URL}/anime?search=${encodeURIComponent(query)}&page=${page}&order_by=${orderBy}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const results = [];
        
        $('.product__item').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            const title = $el.find('.product__item__text h5 a').text().trim();
            const poster = $el.find('.product__item__pic').attr('data-setbg');
            
            // Extract rating
            const rating = $el.find('.ep .fa-star').next('span').text().trim();
            
            // Extract status
            const status = $el.find('.d-none span').text().trim() || 'ONGOING';
            
            // Extract type and quality tags
            const tags = [];
            $el.find('.product__item__text ul a').each((j, tag) => {
                const tagText = $(tag).text().trim();
                const tagHref = $(tag).attr('href');
                if (tagText && tagHref) {
                    tags.push({
                        label: tagText,
                        url: tagHref
                    });
                }
            });
            
            if (title && href) {
                const animeId = extractAnimeId(href);
                const slug = extractSlug(href);
                
                results.push({
                    anime_id: animeId,
                    slug: slug,
                    title: title,
                    poster: proxyImageUrl(poster),
                    rating: rating || 'N/A',
                    status: status,
                    tags: tags,
                    anime_url: `${BASE_URL}/anime/${animeId}/${slug}`
                });
            }
        });
        
        // Check for pagination
        const $pagination = $('.product__pagination');
        
        // Get total pages if available
        let totalPages = null;
        $pagination.find('a').each((i, el) => {
            const pageNum = parseInt($(el).text());
            if (!isNaN(pageNum) && (totalPages === null || pageNum > totalPages)) {
                totalPages = pageNum;
            }
        });
        
        // Determine has_next and has_prev
        const hasNext = totalPages ? page < totalPages : false;
        const hasPrev = page > 1;
        
        return {
            results: results,
            query: query,
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total_results: results.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeSearch error:', error.message);
        throw error;
    }
}

// Scrape ongoing anime list
async function scrapeOngoing(page = 1, orderBy = 'updated') {
    try {
        const url = `${BASE_URL}/quick/ongoing?order_by=${orderBy}&page=${page}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const animeList = [];
        
        $('.product__item').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            const title = $el.find('.product__item__text h5 a').text().trim();
            const poster = $el.find('.product__item__pic').attr('data-setbg');
            
            // Extract episode info
            const episodeText = $el.find('.ep span').text().trim();
            const episodeMatch = episodeText.match(/Ep\s+(\d+)\s*\/\s*(.+)/);
            const currentEpisode = episodeMatch ? episodeMatch[1] : null;
            const totalEpisodes = episodeMatch ? episodeMatch[2] : null;
            
            // Check if trending (has fire icon)
            const isTrending = $el.find('.pin .fa-fire').length > 0;
            
            // Extract type and quality tags
            const tags = [];
            $el.find('.product__item__text ul a').each((j, tag) => {
                const tagText = $(tag).text().trim();
                const tagHref = $(tag).attr('href');
                if (tagText && tagHref) {
                    tags.push({
                        label: tagText,
                        url: tagHref
                    });
                }
            });
            
            if (title && href) {
                const animeId = extractAnimeId(href);
                const slug = extractSlug(href);
                
                animeList.push({
                    anime_id: animeId,
                    slug: slug,
                    title: title,
                    poster: proxyImageUrl(poster),
                    current_episode: currentEpisode,
                    total_episodes: totalEpisodes,
                    episode_text: episodeText,
                    is_trending: isTrending,
                    tags: tags,
                    latest_episode_url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
                    anime_url: `${BASE_URL}/anime/${animeId}/${slug}`
                });
            }
        });
        
        // Check for pagination
        const $pagination = $('.product__pagination');
        
        // Get total pages if available
        let totalPages = null;
        $pagination.find('a').each((i, el) => {
            const pageNum = parseInt($(el).text());
            if (!isNaN(pageNum) && (totalPages === null || pageNum > totalPages)) {
                totalPages = pageNum;
            }
        });
        
        // Determine has_next and has_prev based on current page and total pages
        const hasNext = totalPages ? page < totalPages : false;
        const hasPrev = page > 1;
        
        return {
            anime_list: animeList,
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total_anime: animeList.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeOngoing error:', error.message);
        throw error;
    }
}

// Scrape finished anime list
async function scrapeFinished(page = 1, orderBy = 'updated') {
    try {
        const url = `${BASE_URL}/quick/finished?order_by=${orderBy}&page=${page}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const animeList = [];
        
        $('.product__item').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            const title = $el.find('.product__item__text h5 a').text().trim();
            const poster = $el.find('.product__item__pic').attr('data-setbg');
            
            // Extract episode info
            const episodeText = $el.find('.ep span').text().trim();
            const episodeMatch = episodeText.match(/Ep\s+(\d+)\s*\/\s*(.+)/);
            const totalEpisodes = episodeMatch ? episodeMatch[2] : null;
            
            // Check if trending (has fire icon)
            const isTrending = $el.find('.pin .fa-fire').length > 0;
            
            // Extract type and quality tags
            const tags = [];
            $el.find('.product__item__text ul a').each((j, tag) => {
                const tagText = $(tag).text().trim();
                const tagHref = $(tag).attr('href');
                if (tagText && tagHref) {
                    tags.push({
                        label: tagText,
                        url: tagHref
                    });
                }
            });
            
            // Extract last episode number from URL
            const episodeUrlMatch = href.match(/episode\/(\d+)/);
            const lastEpisode = episodeUrlMatch ? episodeUrlMatch[1] : totalEpisodes;
            
            if (title && href) {
                const animeId = extractAnimeId(href);
                const slug = extractSlug(href);
                
                animeList.push({
                    anime_id: animeId,
                    slug: slug,
                    title: title,
                    poster: proxyImageUrl(poster),
                    total_episodes: totalEpisodes,
                    last_episode: lastEpisode,
                    episode_text: episodeText,
                    is_trending: isTrending,
                    tags: tags,
                    last_episode_url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
                    anime_url: `${BASE_URL}/anime/${animeId}/${slug}`
                });
            }
        });
        
        // Check for pagination
        const $pagination = $('.product__pagination');
        
        // Get total pages if available
        let totalPages = null;
        $pagination.find('a').each((i, el) => {
            const pageNum = parseInt($(el).text());
            if (!isNaN(pageNum) && (totalPages === null || pageNum > totalPages)) {
                totalPages = pageNum;
            }
        });
        
        // Determine has_next and has_prev based on current page and total pages
        const hasNext = totalPages ? page < totalPages : false;
        const hasPrev = page > 1;
        
        return {
            anime_list: animeList,
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total_anime: animeList.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeFinished error:', error.message);
        throw error;
    }
}

// Scrape movie anime list
async function scrapeMovie(page = 1, orderBy = 'updated') {
    try {
        const url = `${BASE_URL}/quick/movie?order_by=${orderBy}&page=${page}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const animeList = [];
        
        $('.product__item').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            const title = $el.find('.product__item__text h5 a').text().trim();
            const poster = $el.find('.product__item__pic').attr('data-setbg');
            
            // Movies usually have 1 episode
            const episodeText = $el.find('.ep span').text().trim();
            
            // Check if trending (has fire icon)
            const isTrending = $el.find('.pin .fa-fire').length > 0;
            
            // Extract type and quality tags
            const tags = [];
            $el.find('.product__item__text ul a').each((j, tag) => {
                const tagText = $(tag).text().trim();
                const tagHref = $(tag).attr('href');
                if (tagText && tagHref) {
                    tags.push({
                        label: tagText,
                        url: tagHref
                    });
                }
            });
            
            if (title && href) {
                const animeId = extractAnimeId(href);
                const slug = extractSlug(href);
                
                animeList.push({
                    anime_id: animeId,
                    slug: slug,
                    title: title,
                    poster: proxyImageUrl(poster),
                    episode_text: episodeText,
                    is_trending: isTrending,
                    tags: tags,
                    movie_url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
                    anime_url: `${BASE_URL}/anime/${animeId}/${slug}`
                });
            }
        });
        
        // Check for pagination
        const $pagination = $('.product__pagination');
        
        // Get total pages if available
        let totalPages = null;
        $pagination.find('a').each((i, el) => {
            const pageNum = parseInt($(el).text());
            if (!isNaN(pageNum) && (totalPages === null || pageNum > totalPages)) {
                totalPages = pageNum;
            }
        });
        
        // Determine has_next and has_prev based on current page and total pages
        const hasNext = totalPages ? page < totalPages : false;
        const hasPrev = page > 1;
        
        return {
            anime_list: animeList,
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total_anime: animeList.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeMovie error:', error.message);
        throw error;
    }
}

// Scrape schedule/jadwal rilis
async function scrapeSchedule(day = 'all') {
    try {
        const url = `${BASE_URL}/schedule?scheduled_day=${day}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const scheduleList = [];
        
        $('.product__item').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            const title = $el.find('.product__item__text h5 a').text().trim();
            const poster = $el.find('.product__item__pic').attr('data-setbg');
            
            // Extract next episode info
            const nextEpisodeText = $el.find('.ep span[class*="actual-schedule-ep"]').text().trim();
            const nextEpisodeMatch = nextEpisodeText.match(/Selanjutnya:\s*Ep\s*(\d+)/);
            const nextEpisode = nextEpisodeMatch ? nextEpisodeMatch[1] : null;
            
            // Extract schedule info (day and time)
            const scheduleDay = $el.find('.view-end .fa-calendar').next('span').text().trim();
            const scheduleTime = $el.find('.view-end .fa-clock').next('span').text().trim();
            
            // Extract type and quality tags
            const tags = [];
            $el.find('.product__item__text ul a').each((j, tag) => {
                const tagText = $(tag).text().trim();
                const tagHref = $(tag).attr('href');
                if (tagText && tagHref) {
                    tags.push({
                        label: tagText,
                        url: tagHref
                    });
                }
            });
            
            if (title && href) {
                const animeId = extractAnimeId(href);
                const slug = extractSlug(href);
                
                scheduleList.push({
                    anime_id: animeId,
                    slug: slug,
                    title: title,
                    poster: proxyImageUrl(poster),
                    next_episode: nextEpisode,
                    next_episode_text: nextEpisodeText,
                    schedule_day: scheduleDay,
                    schedule_time: scheduleTime,
                    tags: tags,
                    anime_url: `${BASE_URL}/anime/${animeId}/${slug}`
                });
            }
        });
        
        return {
            schedule_list: scheduleList,
            day: day,
            total_anime: scheduleList.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeSchedule error:', error.message);
        throw error;
    }
}

// Scrape genre list
async function scrapeGenreList() {
    try {
        const url = `${BASE_URL}/properties/genre`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const genres = [];
        
        // Extract genres from kuramanime__genres section
        $('.kuramanime__genres ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a');
            const href = $link.attr('href');
            const name = $link.find('span').text().trim();
            
            if (href && name) {
                const genreMatch = href.match(/\/properties\/genre\/([^?]+)/);
                if (genreMatch) {
                    const genreSlug = genreMatch[1];
                    genres.push({
                        name: name,
                        slug: genreSlug,
                        url: `${BASE_URL}/properties/genre/${genreSlug}`
                    });
                }
            }
        });
        
        return {
            genres: genres,
            total: genres.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeGenreList error:', error.message);
        throw error;
    }
}

// Scrape studio list
async function scrapeStudioList() {
    try {
        const url = `${BASE_URL}/properties/studio`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const studios = [];
        
        // Extract studios from kuramanime__genres section
        $('.kuramanime__genres ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a');
            const href = $link.attr('href');
            const name = $link.find('span').text().trim();
            
            if (href && name) {
                const studioMatch = href.match(/\/properties\/studio\/([^?]+)/);
                if (studioMatch) {
                    const studioSlug = studioMatch[1];
                    studios.push({
                        name: name,
                        slug: studioSlug,
                        url: `${BASE_URL}/properties/studio/${studioSlug}`
                    });
                }
            }
        });
        
        return {
            studios: studios,
            total: studios.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeStudioList error:', error.message);
        throw error;
    }
}

// Scrape type list
async function scrapeTypeList() {
    try {
        const url = `${BASE_URL}/properties/type`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const types = [];
        
        // Extract types from kuramanime__genres section
        $('.kuramanime__genres ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a');
            const href = $link.attr('href');
            const name = $link.find('span').text().trim();
            
            if (href && name) {
                const typeMatch = href.match(/\/properties\/type\/([^?]+)/);
                if (typeMatch) {
                    const typeSlug = typeMatch[1].toLowerCase(); // Normalize to lowercase
                    types.push({
                        name: name,
                        slug: typeSlug,
                        url: `${BASE_URL}/properties/type/${typeSlug}`
                    });
                }
            }
        });
        
        return {
            types: types,
            total: types.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeTypeList error:', error.message);
        throw error;
    }
}

// Scrape anime by quality
async function scrapeQuality(qualitySlug, page = 1, orderBy = 'ascending') {
    try {
        const url = `${BASE_URL}/properties/quality/${qualitySlug}?order_by=${orderBy}&page=${page}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const animeList = [];
        
        $('.product__item').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            const title = $el.find('.product__item__text h5 a').text().trim();
            const poster = $el.find('.product__item__pic').attr('data-setbg');
            
            // Extract rating
            const rating = $el.find('.ep .fa-star').next('span').text().trim();
            
            // Extract status
            const status = $el.find('.d-none span').text().trim() || 'ONGOING';
            
            // Extract type and quality tags
            const tags = [];
            $el.find('.product__item__text ul a').each((j, tag) => {
                const tagText = $(tag).text().trim();
                const tagHref = $(tag).attr('href');
                if (tagText && tagHref) {
                    tags.push({
                        label: tagText,
                        url: tagHref
                    });
                }
            });
            
            if (title && href) {
                const animeId = extractAnimeId(href);
                const slug = extractSlug(href);
                
                animeList.push({
                    anime_id: animeId,
                    slug: slug,
                    title: title,
                    poster: proxyImageUrl(poster),
                    rating: rating || 'N/A',
                    status: status,
                    tags: tags,
                    anime_url: `${BASE_URL}/anime/${animeId}/${slug}`
                });
            }
        });
        
        // Check for pagination
        const $pagination = $('.product__pagination');
        
        // Get total pages if available
        let totalPages = null;
        $pagination.find('a').each((i, el) => {
            const pageNum = parseInt($(el).text());
            if (!isNaN(pageNum) && (totalPages === null || pageNum > totalPages)) {
                totalPages = pageNum;
            }
        });
        
        // Determine has_next and has_prev
        const hasNext = totalPages ? page < totalPages : false;
        const hasPrev = page > 1;
        
        return {
            anime_list: animeList,
            quality: qualitySlug,
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total: animeList.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeQuality error:', error.message);
        throw error;
    }
}

// Scrape quality list
async function scrapeQualityList() {
    try {
        const url = `${BASE_URL}/properties/quality`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const qualities = [];
        
        // Extract qualities from kuramanime__genres section
        $('.kuramanime__genres ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a');
            const href = $link.attr('href');
            const name = $link.find('span').text().trim();
            
            if (href && name) {
                const qualityMatch = href.match(/\/properties\/quality\/([^?]+)/);
                if (qualityMatch) {
                    const qualitySlug = qualityMatch[1].toLowerCase(); // Normalize to lowercase
                    qualities.push({
                        name: name,
                        slug: qualitySlug,
                        url: `${BASE_URL}/properties/quality/${qualitySlug}`
                    });
                }
            }
        });
        
        return {
            qualities: qualities,
            total: qualities.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeQualityList error:', error.message);
        throw error;
    }
}

// Scrape source list (adaptasi)
async function scrapeSourceList() {
    try {
        const url = `${BASE_URL}/properties/source`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const sources = [];
        
        // Extract sources from kuramanime__genres section
        $('.kuramanime__genres ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a');
            const href = $link.attr('href');
            const name = $link.find('span').text().trim();
            
            if (href && name) {
                const sourceMatch = href.match(/\/properties\/source\/([^?]+)/);
                if (sourceMatch) {
                    const sourceSlug = sourceMatch[1];
                    sources.push({
                        name: name,
                        slug: sourceSlug,
                        url: `${BASE_URL}/properties/source/${sourceSlug}`
                    });
                }
            }
        });
        
        return {
            sources: sources,
            total: sources.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeSourceList error:', error.message);
        throw error;
    }
}

// Scrape country list
async function scrapeCountryList() {
    try {
        const url = `${BASE_URL}/properties/country`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const countries = [];
        
        // Extract countries from kuramanime__genres section
        $('.kuramanime__genres ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a');
            const href = $link.attr('href');
            const name = $link.find('span').text().trim();
            
            if (href && name) {
                const countryMatch = href.match(/\/properties\/country\/([^?]+)/);
                if (countryMatch) {
                    const countrySlug = countryMatch[1];
                    countries.push({
                        name: name,
                        slug: countrySlug,
                        url: `${BASE_URL}/properties/country/${countrySlug}`
                    });
                }
            }
        });
        
        return {
            countries: countries,
            total: countries.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeCountryList error:', error.message);
        throw error;
    }
}

// Scrape anime by type
async function scrapeType(typeSlug, page = 1, orderBy = 'ascending') {
    try {
        const url = `${BASE_URL}/properties/type/${typeSlug}?order_by=${orderBy}&page=${page}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const animeList = [];
        
        $('.product__item').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            const title = $el.find('.product__item__text h5 a').text().trim();
            const poster = $el.find('.product__item__pic').attr('data-setbg');
            
            // Extract rating
            const rating = $el.find('.ep .fa-star').next('span').text().trim();
            
            // Extract status
            const status = $el.find('.d-none span').text().trim() || 'ONGOING';
            
            // Extract type and quality tags
            const tags = [];
            $el.find('.product__item__text ul a').each((j, tag) => {
                const tagText = $(tag).text().trim();
                const tagHref = $(tag).attr('href');
                if (tagText && tagHref) {
                    tags.push({
                        label: tagText,
                        url: tagHref
                    });
                }
            });
            
            if (title && href) {
                const animeId = extractAnimeId(href);
                const slug = extractSlug(href);
                
                animeList.push({
                    anime_id: animeId,
                    slug: slug,
                    title: title,
                    poster: proxyImageUrl(poster),
                    rating: rating || 'N/A',
                    status: status,
                    tags: tags,
                    anime_url: `${BASE_URL}/anime/${animeId}/${slug}`
                });
            }
        });
        
        // Check for pagination
        const $pagination = $('.product__pagination');
        
        // Get total pages if available
        let totalPages = null;
        $pagination.find('a').each((i, el) => {
            const pageNum = parseInt($(el).text());
            if (!isNaN(pageNum) && (totalPages === null || pageNum > totalPages)) {
                totalPages = pageNum;
            }
        });
        
        // Determine has_next and has_prev
        const hasNext = totalPages ? page < totalPages : false;
        const hasPrev = page > 1;
        
        return {
            anime_list: animeList,
            type: typeSlug,
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total: animeList.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeType error:', error.message);
        throw error;
    }
}

// Scrape anime by studio
async function scrapeStudio(studioSlug, page = 1, orderBy = 'ascending') {
    try {
        const url = `${BASE_URL}/properties/studio/${studioSlug}?order_by=${orderBy}&page=${page}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const animeList = [];
        
        $('.product__item').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            const title = $el.find('.product__item__text h5 a').text().trim();
            const poster = $el.find('.product__item__pic').attr('data-setbg');
            
            // Extract rating
            const rating = $el.find('.ep .fa-star').next('span').text().trim();
            
            // Extract status
            const status = $el.find('.d-none span').text().trim() || 'ONGOING';
            
            // Extract type and quality tags
            const tags = [];
            $el.find('.product__item__text ul a').each((j, tag) => {
                const tagText = $(tag).text().trim();
                const tagHref = $(tag).attr('href');
                if (tagText && tagHref) {
                    tags.push({
                        label: tagText,
                        url: tagHref
                    });
                }
            });
            
            if (title && href) {
                const animeId = extractAnimeId(href);
                const slug = extractSlug(href);
                
                animeList.push({
                    anime_id: animeId,
                    slug: slug,
                    title: title,
                    poster: proxyImageUrl(poster),
                    rating: rating || 'N/A',
                    status: status,
                    tags: tags,
                    anime_url: `${BASE_URL}/anime/${animeId}/${slug}`
                });
            }
        });
        
        // Check for pagination
        const $pagination = $('.product__pagination');
        
        // Get total pages if available
        let totalPages = null;
        $pagination.find('a').each((i, el) => {
            const pageNum = parseInt($(el).text());
            if (!isNaN(pageNum) && (totalPages === null || pageNum > totalPages)) {
                totalPages = pageNum;
            }
        });
        
        // Determine has_next and has_prev
        const hasNext = totalPages ? page < totalPages : false;
        const hasPrev = page > 1;
        
        return {
            anime_list: animeList,
            studio: studioSlug,
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total: animeList.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeStudio error:', error.message);
        throw error;
    }
}

// Scrape anime by genre
async function scrapeGenre(genreSlug, page = 1, orderBy = 'ascending') {
    try {
        const url = `${BASE_URL}/properties/genre/${genreSlug}?order_by=${orderBy}&page=${page}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const animeList = [];
        
        $('.product__item').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            const title = $el.find('.product__item__text h5 a').text().trim();
            const poster = $el.find('.product__item__pic').attr('data-setbg');
            
            // Extract rating
            const rating = $el.find('.ep .fa-star').next('span').text().trim();
            
            // Extract status
            const status = $el.find('.d-none span').text().trim() || 'ONGOING';
            
            // Extract type and quality tags
            const tags = [];
            $el.find('.product__item__text ul a').each((j, tag) => {
                const tagText = $(tag).text().trim();
                const tagHref = $(tag).attr('href');
                if (tagText && tagHref) {
                    tags.push({
                        label: tagText,
                        url: tagHref
                    });
                }
            });
            
            if (title && href) {
                const animeId = extractAnimeId(href);
                const slug = extractSlug(href);
                
                animeList.push({
                    anime_id: animeId,
                    slug: slug,
                    title: title,
                    poster: proxyImageUrl(poster),
                    rating: rating || 'N/A',
                    status: status,
                    tags: tags,
                    anime_url: `${BASE_URL}/anime/${animeId}/${slug}`
                });
            }
        });
        
        // Check for pagination
        const $pagination = $('.product__pagination');
        
        // Get total pages if available
        let totalPages = null;
        $pagination.find('a').each((i, el) => {
            const pageNum = parseInt($(el).text());
            if (!isNaN(pageNum) && (totalPages === null || pageNum > totalPages)) {
                totalPages = pageNum;
            }
        });
        
        // Determine has_next and has_prev
        const hasNext = totalPages ? page < totalPages : false;
        const hasPrev = page > 1;
        
        return {
            anime_list: animeList,
            genre: genreSlug,
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total_anime: animeList.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeGenre error:', error.message);
        throw error;
    }
}

// Scrape season list
async function scrapeSeasonList() {
    try {
        const url = `${BASE_URL}/properties/season`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const seasons = [];
        
        // Extract seasons from kuramanime__seasons section
        $('.kuramanime__genres ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a');
            const href = $link.attr('href');
            const name = $link.find('span').text().trim();
            
            if (href && name) {
                const seasonMatch = href.match(/\/properties\/season\/([^?]+)/);
                if (seasonMatch) {
                    const seasonSlug = seasonMatch[1];
                    seasons.push({
                        name: name,
                        slug: seasonSlug,
                        url: `${BASE_URL}/properties/season/${seasonSlug}`
                    });
                }
            }
        });
        
        return {
            seasons: seasons,
            total: seasons.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeSeasonList error:', error.message);
        throw error;
    }
}

// Scrape anime by season
async function scrapeSeason(seasonSlug, page = 1, orderBy = 'ascending') {
    try {
        const url = `${BASE_URL}/properties/season/${seasonSlug}?order_by=${orderBy}&page=${page}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const animeList = [];
        
        $('.product__item').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            const title = $el.find('.product__item__text h5 a').text().trim();
            const poster = $el.find('.product__item__pic').attr('data-setbg');
            
            // Extract rating
            const rating = $el.find('.ep .fa-star').next('span').text().trim();
            
            // Extract status
            const status = $el.find('.d-none span').text().trim() || 'ONGOING';
            
            // Extract type and quality tags
            const tags = [];
            $el.find('.product__item__text ul a').each((j, tag) => {
                const tagText = $(tag).text().trim();
                const tagHref = $(tag).attr('href');
                if (tagText && tagHref) {
                    tags.push({
                        label: tagText,
                        url: tagHref
                    });
                }
            });
            
            if (title && href) {
                const animeId = extractAnimeId(href);
                const slug = extractSlug(href);
                
                animeList.push({
                    anime_id: animeId,
                    slug: slug,
                    title: title,
                    poster: proxyImageUrl(poster),
                    rating: rating || 'N/A',
                    status: status,
                    tags: tags,
                    anime_url: `${BASE_URL}/anime/${animeId}/${slug}`
                });
            }
        });
        
        // Check for pagination
        const $pagination = $('.product__pagination');
        
        // Get total pages if available
        let totalPages = null;
        $pagination.find('a').each((i, el) => {
            const pageNum = parseInt($(el).text());
            if (!isNaN(pageNum) && (totalPages === null || pageNum > totalPages)) {
                totalPages = pageNum;
            }
        });
        
        // Determine has_next and has_prev
        const hasNext = totalPages ? page < totalPages : false;
        const hasPrev = page > 1;
        
        return {
            anime_list: animeList,
            season: seasonSlug,
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total_anime: animeList.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeSeason error:', error.message);
        throw error;
    }
}

// Scrape batch download page
async function scrapeBatch(animeId, slug, batchRange) {
    let browser;
    try {
        const url = `${BASE_URL}/anime/${animeId}/${slug}/batch/${batchRange}`;
        
        // Use Puppeteer to handle dynamic content
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: '/snap/bin/chromium',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        await page.goto(url, { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        const html = await page.content();
        const $ = cheerio.load(html);
        
        const result = {
            title: '',
            poster: '',
            synopsis: '',
            info: {},
            genres: [],
            download_links: []
        };
        
        // Get title from breadcrumb or page title
        result.title = $('#episodeTitle').text().trim().replace('[BATCH]', '').trim();
        if (!result.title) {
            result.title = $('.anime__details__title h3').text().trim().replace('[BATCH]', '').trim();
        }
        
        // Get poster
        result.poster = proxyImageUrl($('.anime__details__pic').attr('data-setbg'));
        
        // Get synopsis
        result.synopsis = $('.anime__details__text p').text().trim();
        
        // Get info (similar to detail page)
        $('.anime__details__widget ul li').each((i, el) => {
            const $el = $(el);
            const label = $el.find('.col-3 span').text().trim().replace(':', '');
            const $valueCol = $el.find('.col-9');
            let value = $valueCol.find('a').text().trim();
            if (!value) {
                value = $valueCol.text().trim();
            }
            
            if (label && value) {
                result.info[label.toLowerCase().replace(/\s+/g, '_')] = value;
            }
        });
        
        // Get genres
        $('.anime__details__widget .row .col-lg-6:last-child li').each((i, el) => {
            const $el = $(el);
            $el.find('a').each((j, genreEl) => {
                result.genres.push($(genreEl).text().trim());
            });
        });
        
        // Extract download links using data-kk method (same as episode)
        // Step 1: Extract data-kk attribute
        const dataKk = $('[data-kk]').attr('data-kk');
        if (!dataKk) {
            console.warn('data-kk attribute not found in batch page');
            await browser.close();
            return result;
        }
        
        console.log(`[Batch] Found data-kk: ${dataKk}`);
        
        // Step 2: Fetch JS file to get environment variables
        const jsUrl = `${BASE_URL}/assets/js/${dataKk}.js`;
        const jsResponse = await axios.get(jsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': url
            }
        });
        
        // Step 3: Parse environment variables from JS
        const jsContent = jsResponse.data;
        const envMatch = jsContent.match(/window\.process\s*=\s*{\s*env:\s*({[^}]+})/);
        if (!envMatch) {
            console.warn('Could not parse environment variables from JS');
            await browser.close();
            return result;
        }
        
        // Extract env variables
        const envVars = {};
        const envContent = envMatch[1];
        const varMatches = envContent.matchAll(/(\w+):\s*['"]([^'"]+)['"]/g);
        for (const match of varMatches) {
            envVars[match[1]] = match[2];
        }
        
        console.log('[Batch] Parsed env vars:', Object.keys(envVars));
        
        // Step 4: Fetch auth token
        const authTokenUrl = `${BASE_URL}/${envVars.MIX_PREFIX_AUTH_ROUTE_PARAM || 'assets/'}${envVars.MIX_AUTH_ROUTE_PARAM}`;
        const tokenResponse = await axios.get(authTokenUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': url
            }
        });
        
        const authToken = tokenResponse.data.trim();
        console.log('[Batch] Auth token obtained');
        
        // Step 5: Fetch batch download page with auth token
        const pageTokenKey = envVars.MIX_PAGE_TOKEN_KEY;
        const serverKey = envVars.MIX_STREAM_SERVER_KEY;
        
        // For batch, we typically use 'kuramadrive' as the server
        const batchUrl = `${url}?${pageTokenKey}=${authToken}&${serverKey}=kuramadrive&page=1`;
        
        console.log('[Batch] Fetching download links from:', batchUrl);
        
        const batchResponse = await axios.get(batchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': url
            },
            timeout: 15000
        });
        
        const $batch = cheerio.load(batchResponse.data);
        
        // Extract download links with quality and size info
        let currentQuality = 'Unknown';
        let currentSize = '';
        
        $batch('#animeDownloadLink > *').each((i, el) => {
            const $el = $batch(el);
            
            // Check if this is a header/quality indicator (h6, p, h4, h5)
            if ($el.is('h6') || $el.is('p') || $el.is('h4') || $el.is('h5') || $el.hasClass('download-header')) {
                const headerText = $el.text().trim();
                
                // Extract format (MKV, MP4, etc.)
                const formatMatch = headerText.match(/(MKV|MP4|AVI)/i);
                const currentFormat = formatMatch ? formatMatch[1].toUpperCase() : '';
                
                // Extract resolution (360p, 480p, 720p, 1080p)
                const resolutionMatch = headerText.match(/(\d+p)/i);
                const resolution = resolutionMatch ? resolutionMatch[1] : '';
                
                // Extract subtitle type
                const subType = headerText.match(/\((Softsub|Hardsub)\)/i);
                const subTypeStr = subType ? subType[1] : '';
                
                // Extract size (e.g., "204.23 MB", "1.5 GB")
                const sizeMatch = headerText.match(/—\s*\(([^)]+)\)/);
                currentSize = sizeMatch ? sizeMatch[1].trim() : '';
                
                // Build full quality string with size included
                if (currentFormat && resolution) {
                    currentQuality = `${currentFormat} ${resolution}${subTypeStr ? ' (' + subTypeStr + ')' : ''}${currentSize ? ' ' + currentSize : ''}`.trim();
                    console.log(`[Batch] Found quality: ${currentQuality}`);
                }
            }
            // Check if this is a download link
            else if ($el.is('a')) {
                const href = $el.attr('href');
                const linkText = $el.text().trim();
                
                // Filter out invalid links
                if (href && linkText && href.startsWith('http') &&
                    !linkText.toLowerCase().includes('loading') &&
                    !linkText.toLowerCase().includes('sebentar')) {
                    result.download_links.push({
                        quality: currentQuality,
                        provider: linkText,
                        url: href
                    });
                }
            }
        });
        
        console.log(`[Batch] Extracted ${result.download_links.length} download links`);
        
        await browser.close();
        browser = null;
        
        return result;
    } catch (error) {
        console.error('Kuramanime scrapeBatch error:', error.message);
        if (browser) {
            await browser.close();
        }
        throw error;
    }
}

module.exports = {
    scrapeHome,
    scrapeDetail,
    scrapeEpisode,
    scrapeSearch,
    scrapeOngoing,
    scrapeFinished,
    scrapeMovie,
    scrapeSchedule,
    scrapeGenreList,
    scrapeGenre,
    scrapeSeasonList,
    scrapeSeason,
    scrapeStudioList,
    scrapeStudio,
    scrapeTypeList,
    scrapeType,
    scrapeQualityList,
    scrapeQuality,
    scrapeSourceList,
    scrapeCountryList,
    scrapeBatch,
    getImageUrlMap
};
