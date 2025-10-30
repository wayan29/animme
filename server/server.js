const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs').promises;
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const scraper = require('./otakudesu');
const samehadakuScraper = require('./samehadaku');
const kuramanimeScraper = require('./kuramanime');
const anichinScraper = require('./anichin');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for public API access
app.use(cors({
    origin: '*', // Allow all origins (can be restricted to specific domains)
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
const CACHE_DIR = path.join(__dirname, '../cache/images');

const DEFAULT_REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
};

const ITAG_QUALITY_MAP = {
    '18': '360p',
    '22': '720p',
    '37': '1080p',
    '59': '480p',
    '78': '480p',
    '82': '360p',
    '83': '480p',
    '84': '720p',
    '85': '1080p'
};

// Ensure cache directory exists
fs.mkdir(CACHE_DIR, { recursive: true }).catch(console.error);

// Serve static files FIRST (important for .js, .css, etc)
app.use(express.static(path.join(__dirname, '../public')));

// Serve cached images
app.get('/cache/img/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const imagePath = path.join(__dirname, '../cache/images', filename);
        
        // Check if file exists
        await fs.access(imagePath);
        
        // Determine content type
        const ext = path.extname(filename).toLowerCase();
        const contentType = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.gif': 'image/gif'
        }[ext] || 'image/jpeg';
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
        res.sendFile(imagePath);
    } catch (error) {
        res.status(404).send('Image not found');
    }
});

// Helper: Generate hash from URL
function getImageHash(url) {
    return crypto.createHash('md5').update(url).digest('hex');
}

// Helper: Get file extension from URL or content-type
function getFileExtension(url, contentType) {
    // Try to get from URL first
    const urlExt = path.extname(new URL(url).pathname).toLowerCase();
    if (urlExt && ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(urlExt)) {
        return urlExt;
    }
    
    // Fallback to content-type
    if (contentType) {
        const typeMap = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp'
        };
        return typeMap[contentType] || '.jpg';
    }
    
    return '.jpg';
}

function buildRequestHeaders(customHeaders = {}, refererUrl = '') {
    const headers = { ...DEFAULT_REQUEST_HEADERS, ...customHeaders };
    if (refererUrl) {
        headers['Referer'] = refererUrl;
    } else if (!headers['Referer']) {
        headers['Referer'] = 'https://otakudesu.best/';
    }
    return headers;
}

async function fetchHtmlContent(url, options = {}) {
    const headers = buildRequestHeaders(options.headers || {}, options.referer);
    const response = await axios.get(url, {
        headers,
        timeout: options.timeout || 12000,
        responseType: 'text'
    });
    return response.data;
}

function normalizeUrl(value, baseUrl) {
    if (!value) return null;
    try {
        if (value.startsWith('//')) {
            return `https:${value}`;
        }
        return new URL(value, baseUrl).toString();
    } catch (error) {
        return value;
    }
}

function extractIframeSource(html, baseUrl) {
    if (!html) return null;
    try {
        const $ = cheerio.load(html);
        const iframe = $('iframe').first();
        if (!iframe || iframe.length === 0) return null;
        const srcAttr = iframe.attr('src') || iframe.attr('data-src');
        if (!srcAttr || srcAttr === 'about:blank') return null;
        return normalizeUrl(srcAttr.trim(), baseUrl);
    } catch (error) {
        return null;
    }
}

function extractMimeFromUrl(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        const mime = parsed.searchParams.get('mime');
        return mime ? decodeURIComponent(mime) : null;
    } catch (error) {
        return null;
    }
}

function mapItagToQuality(formatId) {
    if (!formatId) return null;
    if (ITAG_QUALITY_MAP[formatId]) return ITAG_QUALITY_MAP[formatId];
    if (/^\d+$/.test(formatId)) {
        return `${formatId}p`;
    }
    return formatId;
}

function extractBloggerVideoFromHtml(html) {
    if (!html) return null;
    const match = html.match(/var\s+VIDEO_CONFIG\s*=\s*(\{[\s\S]*?\});/);
    if (!match) return null;
    try {
        const config = JSON.parse(match[1]);
        const streams = Array.isArray(config.streams) ? config.streams : [];
        const sources = streams.map((stream) => {
            if (!stream.play_url) return null;
            return {
                url: stream.play_url,
                mime: stream.mime || extractMimeFromUrl(stream.play_url),
                format_id: stream.format_id || null,
                quality: stream.quality || mapItagToQuality(stream.format_id) || null,
                label: stream.label || mapItagToQuality(stream.format_id) || null
            };
        }).filter(Boolean);
        if (!sources.length) return null;
        return {
            type: 'video',
            provider: 'blogger',
            poster: config.thumbnail || null,
            sources
        };
    } catch (error) {
        console.warn('VIDEO_CONFIG parse error:', error.message);
        return null;
    }
}

async function tryJsonVideoEndpoint(streamUrl) {
    try {
        const separator = streamUrl.includes('?') ? '&' : '?';
        const jsonUrl = `${streamUrl}${separator}mode=json&_=${Date.now()}`;
        const response = await axios.get(jsonUrl, {
            headers: buildRequestHeaders({}, streamUrl),
            timeout: 8000
        });
        if (response.data && response.data.video) {
            return normalizeUrl(response.data.video, streamUrl);
        }
    } catch (error) {
        return null;
    }
    return null;
}

async function resolveStreamUrl(streamUrl, depth = 0, visited = new Set()) {
    if (!streamUrl || depth > 4 || visited.has(streamUrl)) {
        return null;
    }
    visited.add(streamUrl);
    let html;
    try {
        html = await fetchHtmlContent(streamUrl, { referer: 'https://otakudesu.best/' });
    } catch (error) {
        console.warn('Failed to fetch stream html:', error.message);
        return null;
    }
    const bloggerVideo = extractBloggerVideoFromHtml(html);
    if (bloggerVideo) {
        return bloggerVideo;
    }
    const iframeSrc = extractIframeSource(html, streamUrl);
    if (iframeSrc) {
        const nested = await resolveStreamUrl(iframeSrc, depth + 1, visited);
        if (nested) {
            return nested;
        }
    }
    const jsonSrc = await tryJsonVideoEndpoint(streamUrl);
    if (jsonSrc) {
        const nestedFromJson = await resolveStreamUrl(jsonSrc, depth + 1, visited);
        if (nestedFromJson) {
            return nestedFromJson;
        }
    }
    return null;
}

// Serve cached images with auto-download - URL SEPENUHNYA TERSEMBUNYI
app.get('/img/:hash', async (req, res) => {
    try {
        const hash = req.params.hash;
        
        // Try to find cached file
        const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        let filePath = null;
        
        for (const ext of extensions) {
            const testPath = path.join(CACHE_DIR, hash + ext);
            try {
                await fs.access(testPath);
                filePath = testPath;
                break;
            } catch (e) {
                // Continue checking
            }
        }
        
        // If cached, serve immediately
        if (filePath) {
            const ext = path.extname(filePath);
            const contentTypeMap = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp'
            };
            
            res.set('Content-Type', contentTypeMap[ext] || 'image/jpeg');
            res.set('Cache-Control', 'public, max-age=31536000'); // 1 year
            
            const imageBuffer = await fs.readFile(filePath);
            return res.send(imageBuffer);
        }
        
        // Not cached - need original URL to download
        // Check all scrapers for image URL
        const imageUrlMapV1 = scraper.getImageUrlMap();
        const imageUrlMapV2 = samehadakuScraper.getImageUrlMap();
        const imageUrlMapV3 = kuramanimeScraper.getImageUrlMap();
        
        let originalUrl = imageUrlMapV1.get(hash) || imageUrlMapV2.get(hash) || imageUrlMapV3.get(hash);
        
        if (!originalUrl) {
            return res.status(404).send('Image not found and no URL mapping');
        }
        
        // Download and cache
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(originalUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://otakudesu.best/'
            },
            timeout: 10000
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        const ext = getFileExtension(originalUrl, contentType);
        const newFilePath = path.join(CACHE_DIR, hash + ext);
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await fs.writeFile(newFilePath, buffer);
        
        console.log(`✓ Downloaded & cached: ${hash}${ext}`);
        
        res.set('Content-Type', contentType || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=31536000');
        res.send(buffer);
    } catch (error) {
        console.error('Image serve error:', error.message);
        res.status(500).send('Failed to load image');
    }
});

// API Endpoints - Using Scraper
app.get('/api/home', async (req, res) => {
    try {
        console.log('Scraping homepage...');
        const data = await scraper.scrapeHome();
        res.json(data);
    } catch (error) {
        console.error('API Error /home:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/anime/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        console.log(`Scraping anime detail: ${slug}`);
        const data = await scraper.scrapeAnimeDetail(slug);
        res.json(data);
    } catch (error) {
        console.error('API Error /anime:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/search/:keyword', async (req, res) => {
    try {
        const keyword = req.params.keyword;
        console.log(`Searching for: ${keyword}`);
        const data = await scraper.scrapeSearch(keyword);
        res.json(data);
    } catch (error) {
        console.error('API Error /search:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/ongoing-anime/:page?', async (req, res) => {
    try {
        const page = parseInt(req.params.page) || 1;
        console.log(`Scraping ongoing anime page ${page}`);
        const data = await scraper.scrapeOngoingAnime(page);
        res.json(data);
    } catch (error) {
        console.error('API Error /ongoing-anime:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/complete-anime/:page?', async (req, res) => {
    try {
        const page = parseInt(req.params.page) || 1;
        console.log(`Scraping complete anime page ${page}`);
        const data = await scraper.scrapeCompleteAnime(page);
        res.json(data);
    } catch (error) {
        console.error('API Error /complete-anime:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/all-anime', async (req, res) => {
    try {
        console.log('Scraping all anime list...');
        const data = await scraper.scrapeAllAnime();
        res.json(data);
    } catch (error) {
        console.error('API Error /all-anime:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/genres', async (req, res) => {
    try {
        console.log('Scraping genre list...');
        const data = await scraper.scrapeGenreList();
        res.json(data);
    } catch (error) {
        console.error('API Error /genres:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/genre/:slug/:page?', async (req, res) => {
    try {
        const slug = req.params.slug;
        const page = parseInt(req.params.page) || 1;
        console.log(`Scraping genre ${slug} page ${page}`);
        const data = await scraper.scrapeGenreAnime(slug, page);
        res.json(data);
    } catch (error) {
        console.error('API Error /genre:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/episode/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        console.log(`Scraping episode: ${slug}`);
        const data = await scraper.scrapeEpisode(slug);
        res.json(data);
    } catch (error) {
        console.error('API Error /episode:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/batch/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        console.log(`Scraping batch: ${slug}`);
        const data = await scraper.scrapeBatch(slug);
        res.json(data);
    } catch (error) {
        console.error('API Error /batch:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/schedule', async (req, res) => {
    try {
        console.log('Scraping schedule...');
        const data = await scraper.scrapeSchedule();
        res.json(data);
    } catch (error) {
        console.error('API Error /schedule:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// API to get stream URL for specific quality/server
app.get('/api/stream/:postId/:quality/:serverIndex', async (req, res) => {
    try {
        const { postId, quality, serverIndex } = req.params;
        const shouldResolve = req.query.resolve === '1';
        console.log(`Fetching stream URL for post ${postId}, quality ${quality}, server ${serverIndex}`);
        
        // Step 1: Get nonce
        const nonceResponse = await axios.post('https://otakudesu.best/wp-admin/admin-ajax.php', 
            new URLSearchParams({
                action: 'aa1208d27f29ca340c92c66d1926f13f'
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }
        );
        
        const nonce = nonceResponse.data.data;
        
        if (!nonce) {
            throw new Error('Failed to get nonce');
        }
        
        // Step 2: Get stream URL with nonce
        const streamResponse = await axios.post('https://otakudesu.best/wp-admin/admin-ajax.php',
            new URLSearchParams({
                id: postId,
                i: serverIndex,
                q: quality,
                nonce: nonce,
                action: '2a3505c93b0035d3f455df82bf976b84'
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }
        );
        
        // Step 3: Decode base64 response
        const base64Html = streamResponse.data.data;
        const decodedHtml = Buffer.from(base64Html, 'base64').toString('utf-8');
        
        // Step 4: Extract iframe src
        const srcMatch = decodedHtml.match(/src="([^"]+)"/);
        const streamUrl = srcMatch ? srcMatch[1] : null;
        
        if (!streamUrl) {
            throw new Error('Failed to extract stream URL');
        }
        
        let resolved = null;
        if (shouldResolve) {
            resolved = await resolveStreamUrl(streamUrl);
        }
        
        res.json({
            status: 'success',
            data: {
                stream_url: streamUrl,
                quality: quality,
                server_index: serverIndex,
                resolved: resolved
            }
        });
    } catch (error) {
        console.error('API Error /stream:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/resolve-stream', async (req, res) => {
    try {
        const rawUrl = req.query.url;
        if (!rawUrl) {
            return res.status(400).json({ status: 'error', message: 'Parameter url wajib diisi' });
        }
        let decodedUrl = rawUrl;
        try {
            decodedUrl = decodeURIComponent(rawUrl);
        } catch (error) {
            // Keep original when decode fails
        }
        const resolved = await resolveStreamUrl(decodedUrl);
        res.json({
            status: 'success',
            data: {
                stream_url: decodedUrl,
                resolved
            }
        });
    } catch (error) {
        console.error('API Error /resolve-stream:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// ==================== API V2 - SAMEHADAKU ====================

app.get('/api/v2/home', async (req, res) => {
    try {
        console.log('[V2] Scraping samehadaku homepage...');
        const data = await samehadakuScraper.scrapeHome();
        res.json(data);
    } catch (error) {
        console.error('[V2] API Error /home:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v2/anime/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        console.log(`[V2] Scraping samehadaku anime detail: ${slug}`);
        const data = await samehadakuScraper.scrapeAnimeDetail(slug);
        res.json(data);
    } catch (error) {
        console.error('[V2] API Error /anime:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v2/player-stream', async (req, res) => {
    try {
        const postId = req.query.post || req.query.postId;
        const nume = req.query.nume || '1';
        const type = req.query.type || 'schtml';
        
        if (!postId) {
            return res.status(400).json({ status: 'error', message: 'Parameter post wajib diisi' });
        }
        
        console.log(`[V2] Fetching Samehadaku player iframe post=${postId}, nume=${nume}, type=${type}`);
        const iframeSrc = await samehadakuScraper.fetchAjaxPlayerIframe({ post: postId, nume, type });
        
        if (!iframeSrc) {
            return res.status(404).json({ status: 'error', message: 'Stream tidak ditemukan' });
        }
        
        res.json({
            status: 'success',
            data: {
                stream_url: iframeSrc,
                post_id: postId,
                nume,
                type
            }
        });
    } catch (error) {
        console.error('[V2] API Error /player-stream:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v2/search/:keyword', async (req, res) => {
    try {
        const keyword = req.params.keyword;
        console.log(`[V2] Searching samehadaku for: ${keyword}`);
        const data = await samehadakuScraper.scrapeSearch(keyword);
        res.json(data);
    } catch (error) {
        console.error('[V2] API Error /search:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v2/anime-list/:page?', async (req, res) => {
    try {
        const page = parseInt(req.params.page) || 1;
        console.log(`[V2] Scraping samehadaku anime list page ${page}`);
        const data = await samehadakuScraper.scrapeAnimeList(page);
        res.json(data);
    } catch (error) {
        console.error('[V2] API Error /anime-list:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v2/terbaru/:page?', async (req, res) => {
    try {
        const page = parseInt(req.params.page) || 1;
        const pagesToLoad = parseInt(req.query.pages) || 1; // Load multiple pages
        
        console.log(`[V2] Scraping samehadaku anime terbaru, page ${page}, loading ${pagesToLoad} pages`);
        
        if (pagesToLoad === 1) {
            const data = await samehadakuScraper.scrapeAnimeList(page);
            // Add items_per_page for consistency
            if (data.status === 'success' && data.data.paginationData) {
                data.data.paginationData.items_per_page = 16;
                data.data.paginationData.total_items = data.data.animeData.length;
            }
            res.json(data);
        } else {
            // Load multiple pages and combine results
            const allAnimeData = [];
            let basePaginationData = null;
            
            for (let i = 0; i < pagesToLoad; i++) {
                const currentPageNum = page + i;
                try {
                    const data = await samehadakuScraper.scrapeAnimeList(currentPageNum);
                    if (data.status === 'success' && data.data.animeData) {
                        allAnimeData.push(...data.data.animeData);
                        
                        // Get base pagination from first page
                        if (basePaginationData === null) {
                            basePaginationData = data.data.paginationData;
                        }
                        
                        // Stop if this page has no data or is last page
                        if (!data.data.paginationData.has_next_page) {
                            break;
                        }
                    }
                } catch (error) {
                    console.warn(`[V2] Failed to load page ${currentPageNum}:`, error.message);
                    break;
                }
            }
            
            // Calculate adjusted pagination for combined pages
            const totalPages = basePaginationData ? Math.ceil(basePaginationData.last_page / pagesToLoad) : 1;
            const currentPageAdjusted = Math.ceil(page / pagesToLoad);
            const hasNextPageAdjusted = (currentPageAdjusted * pagesToLoad) < basePaginationData.last_page;
            
            res.json({
                status: 'success',
                data: {
                    animeData: allAnimeData,
                    paginationData: {
                        current_page: currentPageAdjusted,
                        last_page: totalPages,
                        total_pages: totalPages,
                        has_next_page: hasNextPageAdjusted,
                        has_previous_page: currentPageAdjusted > 1,
                        next_page: currentPageAdjusted + 1,
                        previous_page: currentPageAdjusted - 1,
                        items_per_page: pagesToLoad * 16,
                        total_items: allAnimeData.length,
                        // Keep original pagination for reference
                        original_pagination: basePaginationData
                    }
                }
            });
        }
    } catch (error) {
        console.error('[V2] API Error /terbaru:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v2/all-anime', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const filters = {
            title: req.query.title || '',
            status: req.query.status || '',
            type: req.query.type || '',
            order: req.query.order || 'title',
            genre: req.query.genre ? (Array.isArray(req.query.genre) ? req.query.genre : [req.query.genre]) : []
        };
        
        console.log(`[V2] Scraping samehadaku all anime page ${page} with filters:`, filters);
        const data = await samehadakuScraper.scrapeAllAnime(filters, page);
        res.json(data);
    } catch (error) {
        console.error('[V2] API Error /all-anime:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v2/schedule', async (req, res) => {
    try {
        console.log('[V2] Scraping samehadaku schedule...');
        const data = await samehadakuScraper.scrapeSchedule();
        res.json(data);
    } catch (error) {
        console.error('[V2] API Error /schedule:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v2/episode/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        console.log(`[V2] Scraping samehadaku episode: ${slug}`);
        const data = await samehadakuScraper.scrapeEpisode(slug);
        res.json(data);
    } catch (error) {
        console.error('[V2] API Error /episode:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// ==================== API V3 - KURAMANIME ====================

app.get('/api/v3/kuramanime/home', async (req, res) => {
    try {
        console.log('[V3] Scraping kuramanime homepage...');
        const data = await kuramanimeScraper.scrapeHome();
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /home:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/anime/:animeId/:slug', async (req, res) => {
    try {
        const { animeId, slug } = req.params;
        console.log(`[V3] Scraping kuramanime anime detail: ${animeId}/${slug}`);
        const data = await kuramanimeScraper.scrapeDetail(animeId, slug);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /anime:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/episode/:animeId/:slug/:episodeNum', async (req, res) => {
    try {
        const { animeId, slug, episodeNum } = req.params;
        console.log(`[V3] Scraping kuramanime episode: ${animeId}/${slug}/${episodeNum}`);
        const data = await kuramanimeScraper.scrapeEpisode(animeId, slug, episodeNum);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /episode:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/search', async (req, res) => {
    try {
        const query = req.query.q || req.query.query || req.query.search;
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || req.query.orderBy || 'ascending';
        
        if (!query) {
            return res.status(400).json({ status: 'error', message: 'Query parameter is required' });
        }
        
        console.log(`[V3] Searching kuramanime for: "${query}" (page ${page}, order: ${orderBy})`);
        const data = await kuramanimeScraper.scrapeSearch(query, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /search:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/anime-list', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || req.query.orderBy || null;
        console.log(`[V3] Scraping kuramanime anime list (page ${page}, order: ${orderBy || 'default'})`);
        const data = await kuramanimeScraper.scrapeAnimeList(page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /anime-list:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/ongoing', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || req.query.orderBy || 'updated';
        console.log(`[V3] Scraping kuramanime ongoing anime (page ${page}, order: ${orderBy})`);
        const data = await kuramanimeScraper.scrapeOngoing(page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /ongoing:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/finished', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || req.query.orderBy || 'updated';
        console.log(`[V3] Scraping kuramanime finished anime (page ${page}, order: ${orderBy})`);
        const data = await kuramanimeScraper.scrapeFinished(page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /finished:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/movie', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || req.query.orderBy || 'updated';
        console.log(`[V3] Scraping kuramanime movie anime (page ${page}, order: ${orderBy})`);
        const data = await kuramanimeScraper.scrapeMovie(page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /movie:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/schedule', async (req, res) => {
    try {
        const day = req.query.day || req.query.scheduled_day || 'all';
        console.log(`[V3] Scraping kuramanime schedule (day: ${day})`);
        const data = await kuramanimeScraper.scrapeSchedule(day);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /schedule:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/genres', async (req, res) => {
    try {
        console.log('[V3] Fetching kuramanime genre list');
        const data = await kuramanimeScraper.scrapeGenreList();
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /genres:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/genre/:slug', async (req, res) => {
    try {
        const genreSlug = req.params.slug;
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || req.query.orderBy || 'ascending';
        console.log(`[V3] Scraping kuramanime genre: ${genreSlug} (page ${page}, order: ${orderBy})`);
        const data = await kuramanimeScraper.scrapeGenre(genreSlug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /genre:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/seasons', async (req, res) => {
    try {
        console.log('[V3] Fetching kuramanime season list');
        const data = await kuramanimeScraper.scrapeSeasonList();
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /seasons:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/season/:slug', async (req, res) => {
    try {
        const seasonSlug = req.params.slug;
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || req.query.orderBy || 'ascending';
        console.log(`[V3] Scraping kuramanime season: ${seasonSlug} (page ${page}, order: ${orderBy})`);
        const data = await kuramanimeScraper.scrapeSeason(seasonSlug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /season:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Studio List
app.get('/api/v3/kuramanime/studios', async (req, res) => {
    try {
        console.log('[V3] Fetching kuramanime studio list');
        const data = await kuramanimeScraper.scrapeStudioList();
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /studios:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Studio Detail (Anime by Studio)
app.get('/api/v3/kuramanime/studio/:studioSlug', async (req, res) => {
    try {
        const { studioSlug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || 'ascending';
        console.log(`[V3] Fetching anime for studio: ${studioSlug} (page ${page})`);
        const data = await kuramanimeScraper.scrapeStudio(studioSlug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error(`[V3] API Error /studio/${req.params.studioSlug}:`, error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Type List
app.get('/api/v3/kuramanime/types', async (req, res) => {
    try {
        console.log('[V3] Fetching kuramanime type list');
        const data = await kuramanimeScraper.scrapeTypeList();
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /types:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Type Detail (Anime by Type)
app.get('/api/v3/kuramanime/type/:typeSlug', async (req, res) => {
    try {
        const { typeSlug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || 'ascending';
        console.log(`[V3] Fetching anime for type: ${typeSlug} (page ${page})`);
        const data = await kuramanimeScraper.scrapeType(typeSlug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error(`[V3] API Error /type/${req.params.typeSlug}:`, error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Quality List
app.get('/api/v3/kuramanime/qualities', async (req, res) => {
    try {
        console.log('[V3] Fetching kuramanime quality list');
        const data = await kuramanimeScraper.scrapeQualityList();
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /qualities:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Quality Detail (Anime by Quality)
app.get('/api/v3/kuramanime/quality/:qualitySlug', async (req, res) => {
    try {
        const { qualitySlug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || 'ascending';
        console.log(`[V3] Fetching anime for quality: ${qualitySlug} (page ${page})`);
        const data = await kuramanimeScraper.scrapeQuality(qualitySlug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error(`[V3] API Error /quality/${req.params.qualitySlug}:`, error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Source List (Adaptasi)
app.get('/api/v3/kuramanime/sources', async (req, res) => {
    try {
        console.log('[V3] Fetching kuramanime source list');
        const data = await kuramanimeScraper.scrapeSourceList();
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /sources:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Source Detail (Anime by Source/Adaptasi)
app.get('/api/v3/kuramanime/source/:sourceSlug', async (req, res) => {
    try {
        const { sourceSlug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || 'ascending';
        console.log(`[V3] Fetching anime for source: ${sourceSlug} (page ${page})`);
        const data = await kuramanimeScraper.scrapeSource(sourceSlug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error(`[V3] API Error /source/${req.params.sourceSlug}:`, error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Country List
app.get('/api/v3/kuramanime/countries', async (req, res) => {
    try {
        console.log('[V3] Fetching kuramanime country list');
        const data = await kuramanimeScraper.scrapeCountryList();
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /countries:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Country Detail (Anime by Country)
app.get('/api/v3/kuramanime/country/:countrySlug', async (req, res) => {
    try {
        const { countrySlug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || 'ascending';
        console.log(`[V3] Fetching anime for country: ${countrySlug} (page ${page})`);
        const data = await kuramanimeScraper.scrapeCountry(countrySlug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error(`[V3] API Error /country/${req.params.countrySlug}:`, error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Properties Overview (All)
app.get('/api/v3/kuramanime/properties', async (req, res) => {
    try {
        console.log('[V3] Fetching all kuramanime properties');
        const [genres, seasons, studios, types, qualities, sources, countries] = await Promise.all([
            kuramanimeScraper.scrapeGenreList(),
            kuramanimeScraper.scrapeSeasonList(),
            kuramanimeScraper.scrapeStudioList(),
            kuramanimeScraper.scrapeTypeList(),
            kuramanimeScraper.scrapeQualityList(),
            kuramanimeScraper.scrapeSourceList(),
            kuramanimeScraper.scrapeCountryList()
        ]);
        res.json({ 
            status: 'success', 
            data: {
                genres,
                seasons,
                studios,
                types,
                qualities,
                sources,
                countries
            }
        });
    } catch (error) {
        console.error('[V3] API Error /properties:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Batch Download
app.get('/api/v3/kuramanime/batch/:animeId/:slug/:range', async (req, res) => {
    try {
        const { animeId, slug, range } = req.params;
        console.log(`[V3] Scraping kuramanime batch: ${animeId}/${slug}/${range}`);
        const data = await kuramanimeScraper.scrapeBatch(animeId, slug, range);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /batch:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Route untuk halaman utama
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Route untuk V1 Otakudesu home alias
app.get('/v1/home', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Route untuk V2 Samehadaku home alias
app.get('/v2/home', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Route untuk V3 Kuramanime home
app.get('/v3', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index-v3.html'));
});

app.get('/v3/home', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index-v3.html'));
});

// Clean URL routes with path parameters
// IMPORTANT: These must exclude files with extensions
app.get('/detail/:slug([^.]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/detail.html'));
});

// Route untuk V2 detail pages
app.get('/detail-v2/:slug([a-zA-Z0-9_-]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/detail-v2.html'));
});

// Route untuk V2 search pages
app.get('/search-v2/:keyword([a-zA-Z0-9_-]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/search-v2.html'));
});

// Route untuk V2 genre pages
app.get('/genre-v2/:slug([a-zA-Z0-9_-]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/genre-v2.html'));
});

// Route pour V2 player pages
app.get('/player-v2/:slug([a-zA-Z0-9_-]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/player-v2.html'));
});

// Route untuk V3 Kuramanime detail pages
app.get('/v3/detail/:animeId/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/detail-v3.html'));
});

app.get('/v3/:animeId(\\d+)/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/detail-v3.html'));
});

// Route untuk V3 Kuramanime search pages
app.get('/v3/search', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/search-v3.html'));
});

// Route untuk V3 Kuramanime season pages
app.get('/v3/seasons', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/seasons-v3.html'));
});

app.get('/v3/season/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/season-v3.html'));
});

// Route untuk V3 Kuramanime genre pages
app.get('/v3/genres', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/genres-v3.html'));
});

app.get('/v3/genre/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/genre-v3.html'));
});

app.get('/player/:episode([^.]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/player.html'));
});

app.get('/batch/:slug([^.]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/batch.html'));
});

app.get('/genre/:slug([^.]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/genre.html'));
});

app.get('/search/:keyword([^.]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/search.html'));
});

// Static routes (no parameters)
const createRoutes = (routePath, fileName) => {
    const filePath = path.join(__dirname, `../public/${fileName}.html`);
    app.get(`/${routePath}`, (req, res) => res.sendFile(filePath));
    app.get(`/${routePath}.html`, (req, res) => res.sendFile(filePath));
};

createRoutes('schedule', 'schedule');
createRoutes('completed', 'completed');
createRoutes('ongoing', 'ongoing');
createRoutes('genres', 'genres');
createRoutes('all-anime', 'all-anime');

// V3 static pages without .html suffix
const v3StaticRoutes = {
    'v3/animelist': 'anime-list-v3',
    'v3/ongoing': 'ongoing-v3',
    'v3/finished': 'finished-v3',
    'v3/movie': 'movie-v3',
    'v3/schedule': 'schedule-v3',
    'v3/properties': 'properties-v3',
    'v3/studios': 'studios-v3',
    'v3/studio': 'studio-v3',
    'v3/types': 'types-v3',
    'v3/type': 'type-v3',
    'v3/qualities': 'qualities-v3',
    'v3/quality': 'quality-v3',
    'v3/sources': 'sources-v3',
    'v3/source': 'source-v3',
    'v3/countries': 'countries-v3',
    'v3/country': 'country-v3',
    'v3/genre': 'genre-v3',
    'v3/episode': 'episode-v3',
    'v3/detail': 'detail-v3'
};

Object.entries(v3StaticRoutes).forEach(([route, file]) => createRoutes(route, file));

// Route for anime-terbaru page (V2 only)
app.get('/anime-terbaru', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/anime-list.html'));
});
app.get('/anime-terbaru.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/anime-list.html'));
});

// V4 API Routes - Anichin.cafe
app.get('/api/v4/anichin/home', async (req, res) => {
    try {
        console.log('[V4] Anichin API - Homepage request');
        const data = await anichinScraper.scrapeHomepage();
        res.json(data);
    } catch (error) {
        console.error('[V4] Anichin API - Homepage error:', error.message);
        res.status(500).json({ 
            status: 'error', 
            message: 'Failed to fetch homepage data',
            data: {
                banner_recommendations: [],
                popular_today: [],
                latest_releases: []
            }
        });
    }
});

app.get('/api/v4/anichin/banner-recommendations', async (req, res) => {
    try {
        console.log('[V4] Anichin API - Banner recommendations request');
        console.log('[V4] Anichin scraper type:', typeof anichinScraper);
        console.log('[V4] Anichin scraper is function:', typeof anichinScraper.scrapeBannerRecommendations);
        const data = await anichinScraper.scrapeBannerRecommendations();
        res.json({ 
            status: 'success', 
            data: data,
            total: data.length 
        });
    } catch (error) {
        console.error('[V4] Anichin API - Banner recommendations error:', error.message);
        console.error('[V4] Full error stack:', error.stack);
        res.status(500).json({ 
            status: 'error', 
            message: 'Failed to fetch banner recommendations',
            data: []
        });
    }
});

app.get('/api/v4/anichin/popular-today', async (req, res) => {
    try {
        console.log('[V4] Anichin API - Popular today request');
        const data = await anichinScraper.scrapePopularToday();
        res.json({ 
            status: 'success', 
            data: data,
            total: data.length 
        });
    } catch (error) {
        console.error('[V4] Anichin API - Popular today error:', error.message);
        res.status(500).json({ 
            status: 'error', 
            message: 'Failed to fetch popular today data',
            data: []
        });
    }
});

app.get('/api/v4/anichin/latest-releases', async (req, res) => {
    try {
        console.log('[V4] Anichin API - Latest releases request');
        const data = await anichinScraper.scrapeLatestReleases();
        res.json({ 
            status: 'success', 
            data: data,
            total: data.length 
        });
    } catch (error) {
        console.error('[V4] Anichin API - Latest releases error:', error.message);
        res.status(500).json({ 
            status: 'error', 
            message: 'Failed to fetch latest releases',
            data: []
        });
    }
});

app.get('/api/v4/anichin/detail/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        console.log(`[V4] Anichin API - Detail request for: ${slug}`);
        const data = await anichinScraper.scrapeAnimeDetail(slug);
        res.json(data);
    } catch (error) {
        console.error(`[V4] Anichin API - Detail error for ${req.params.slug}:`, error.message);
        res.status(500).json({ 
            status: 'error', 
            message: 'Failed to fetch anime detail',
            data: null
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).send('<h1>404 - Halaman tidak ditemukan</h1><a href="/v1/home">Kembali ke Beranda</a>');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 AnimMe Server berjalan di http://0.0.0.0:${PORT}`);
    console.log(`📺 Multi-Server Support:`);
    console.log(`   ├─ V1 (Otakudesu): /api/...`);
    console.log(`   ├─ V2 (Samehadaku): /api/v2/...`);
    console.log(`   ├─ V3 (Kuramanime): /api/v3/kuramanime/...`);
    console.log(`   └─ V4 (Anichin): /api/v4/anichin/...`);
    console.log(`🌐 Buka browser dan akses: http://167.253.159.235:${PORT}\n`);
});
