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
const anoboyScraper = require('./anoboy');
const animeIndoScraper = require('./animeindo');
const nekopoiScraper = require('./nekopoi');
const kusonimeScraper = require('./kusonime');
const auratailScraper = require('./auratail');
const hlsService = require('./hls-service');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize HLS service
hlsService.initialize();

// Enable CORS for public API access
app.use(cors({
    origin: '*', // Allow all origins (can be restricted to specific domains)
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Enable JSON body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
// Serve version-specific files with path prefix (important for version-specific app.js)
app.use('/v1', express.static(path.join(__dirname, '../public/v1')));
app.use('/v2', express.static(path.join(__dirname, '../public/v2')));
app.use('/v3', express.static(path.join(__dirname, '../public/v3')));
app.use('/v4', express.static(path.join(__dirname, '../public/v4')));
app.use('/v5', express.static(path.join(__dirname, '../public/v5')));
app.use('/v6', express.static(path.join(__dirname, '../public/v6')));
app.use('/v7', express.static(path.join(__dirname, '../public/v7')));
app.use('/v8', express.static(path.join(__dirname, '../public/v8')));
app.use('/v9', express.static(path.join(__dirname, '../public/v9')));

// Serve shared assets globally (CSS, docs)
app.use(express.static(path.join(__dirname, '../public/shared')));

// Serve main public directory (for index.html)
app.use(express.static(path.join(__dirname, '../public')));

// Admin Routes
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

app.get('/admin/player', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin/player.html'));
});

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
        const imageUrlMapV5 = anoboyScraper.getImageUrlMap();
        const imageUrlMapV6 = animeIndoScraper.getImageUrlMap();
        const imageUrlMapV7 = nekopoiScraper.getImageUrlMap();
        const imageUrlMapV8 = kusonimeScraper.getImageUrlMap();
        const imageUrlMapV9 = auratailScraper.getImageUrlMap();

        let originalUrl = imageUrlMapV1.get(hash) || imageUrlMapV2.get(hash) || imageUrlMapV3.get(hash) || imageUrlMapV5.get(hash) || imageUrlMapV6.get(hash) || imageUrlMapV7.get(hash) || imageUrlMapV8.get(hash) || imageUrlMapV9.get(hash);

        if (!originalUrl) {
            return res.status(404).send('Image not found and no URL mapping');
        }

        let refererHeader = 'https://otakudesu.best/';
        try {
            const parsedUrl = new URL(originalUrl);
            refererHeader = `${parsedUrl.origin}/`;
        } catch (error) {
            // Keep default referer
        }

        // Download and cache
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(originalUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': refererHeader
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
        console.log(`[V1] Searching for: ${keyword}`);
        const data = await scraper.scrapeSearch(keyword);
        res.json(data);
    } catch (error) {
        console.error('[V1] Search error:', error.message);
        res.status(500).json({
            status: 'error',
            message: error.message,
            note: 'Otakudesu (V1) is protected by Cloudflare. Try /api/v2/search or /api/v3/kuramanime/search'
        });
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

// Genre with query parameter (e.g. ?genre=comedy)
app.get('/api/v3/kuramanime/genre', async (req, res) => {
    try {
        const genreSlug = req.query.genre;
        if (!genreSlug) {
            return res.status(400).json({ status: 'error', message: 'Genre parameter is required' });
        }
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || req.query.orderBy || 'updated';
        console.log(`[V3] Scraping kuramanime genre: ${genreSlug} (page ${page}, order: ${orderBy})`);
        const data = await kuramanimeScraper.scrapeGenre(genreSlug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /genre:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Genre with route parameter (e.g. /genre/comedy)
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

// V3 Kuramanime Type with query parameter (e.g. /type?type=tv)
app.get('/api/v3/kuramanime/type', async (req, res) => {
    try {
        const typeSlug = req.query.type;
        if (!typeSlug) {
            return res.status(400).json({ status: 'error', message: 'Type parameter is required' });
        }
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || req.query.orderBy || 'updated';
        console.log(`[V3] Fetching anime for type: ${typeSlug} (page ${page}, order: ${orderBy})`);
        const data = await kuramanimeScraper.scrapeType(typeSlug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /type:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Type Detail with route parameter (e.g. /type/tv)
app.get('/api/v3/kuramanime/type/:typeSlug', async (req, res) => {
    try {
        const { typeSlug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || 'updated';
        console.log(`[V3] Fetching anime for type: ${typeSlug} (page ${page}, order: ${orderBy})`);
        const data = await kuramanimeScraper.scrapeType(typeSlug, page, orderBy);
        console.log(`[V3] scrapeType returned ${data.anime_list?.length || 0} anime`);
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

// Route untuk halaman utama - now serves index.html from public/
// app.get('/', (req, res) => {
//     res.redirect('/v6/home');
// });

// Route untuk V1 Otakudesu home alias
app.get('/v1/home', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v1/index.html'));
});

// Route untuk V2 Samehadaku home alias
app.get('/v2/home', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v1/index.html'));
});

// Route untuk V3 Kuramanime home
app.get('/v3', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v3/index.html'));
});

app.get('/v3/home', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v3/index.html'));
});

// Route untuk V4 Anichin home
app.get('/v4/home', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v4/index.html'));
});

// Route untuk V5 Anoboy home
app.get('/v5/home', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v5/index.html'));
});

// Route untuk V6 AnimeIndo home
app.get('/v6/home', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v6/index.html'));
});

// Route untuk V7 Nekopoi home
app.get('/v7/home', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v7/index.html'));
});

// Route untuk V8 Kusonime home
app.get('/v8', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v8/index.html'));
});

app.get('/v9', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v9/index.html'));
});

app.get('/v8/home', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v8/index.html'));
});

app.get('/v9/home', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v9/index.html'));
});

app.get('/v9/completed', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v9/completed.html'));
});

app.get('/v9/ongoing', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v9/completed.html'));
});

app.get('/v9/popular', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v9/completed.html'));
});

// V9 Detail Routes
app.get('/v9/detail', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v9/detail.html'));
});

app.get('/v9/episode', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v9/episode.html'));
});

// Clean URL routes with path parameters
// IMPORTANT: These must exclude files with extensions
app.get('/detail/:slug([^.]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v1/detail.html'));
});

// Route untuk V2 detail pages
app.get('/detail-v2/:slug([a-zA-Z0-9_-]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v2/detail.html'));
});

// Route untuk V2 search pages
app.get('/search-v2/:keyword([a-zA-Z0-9_-]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v2/search.html'));
});

// Route untuk V2 genre pages
app.get('/genre-v2/:slug([a-zA-Z0-9_-]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v2/genre.html'));
});

// Route pour V2 player pages
app.get('/player-v2/:slug([a-zA-Z0-9_-]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v2/player.html'));
});

// Route untuk V3 Kuramanime detail pages
app.get('/v3/detail/:animeId/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v3/detail.html'));
});

app.get('/v3/:animeId(\\d+)/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v3/detail.html'));
});

// Route untuk V3 Kuramanime search pages
app.get('/v3/search', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v3/search.html'));
});

// Route untuk V3 Kuramanime season pages
app.get('/v3/seasons', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v3/seasons.html'));
});

app.get('/v3/season/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v3/season.html'));
});

// Route untuk V3 Kuramanime genre pages
app.get('/v3/genres', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v3/genres.html'));
});

app.get('/v3/genre', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v3/genre.html'));
});

app.get('/v3/genre/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v3/genre.html'));
});

app.get('/player/:episode([^.]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v1/player.html'));
});

app.get('/batch/:slug([^.]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v1/batch.html'));
});

app.get('/genre/:slug([^.]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v1/genre.html'));
});

app.get('/search/:keyword([^.]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v1/search.html'));
});

// Static routes (no parameters)
const createRoutes = (routePath, fileName, version = 'v1') => {
    const filePath = path.join(__dirname, `../public/${version}/${fileName}.html`);
    app.get(`/${routePath}`, (req, res) => res.sendFile(filePath));
    app.get(`/${routePath}.html`, (req, res) => res.sendFile(filePath));
};

createRoutes('schedule', 'schedule', 'v1');
createRoutes('completed', 'completed', 'v1');
createRoutes('ongoing', 'ongoing', 'v1');
createRoutes('genres', 'genres', 'v1');
createRoutes('all-anime', 'all-anime', 'v1');

// V3 static pages without .html suffix
const v3StaticRoutes = {
    'v3/animelist': 'anime-list',
    'v3/ongoing': 'ongoing',
    'v3/finished': 'finished',
    'v3/movie': 'movie',
    'v3/schedule': 'schedule',
    'v3/properties': 'properties',
    'v3/studios': 'studios',
    'v3/studio': 'studio',
    'v3/types': 'types',
    'v3/type': 'type',
    'v3/qualities': 'qualities',
    'v3/quality': 'quality',
    'v3/sources': 'sources',
    'v3/source': 'source',
    'v3/countries': 'countries',
    'v3/country': 'country',
    'v3/episode': 'episode',
    'v3/detail': 'detail'
};

Object.entries(v3StaticRoutes).forEach(([route, file]) => {
    const filePath = path.join(__dirname, `../public/v3/${file}.html`);
    app.get(`/${route}`, (req, res) => res.sendFile(filePath));
    app.get(`/${route}.html`, (req, res) => res.sendFile(filePath));
});

// V4 static pages (Anichin)
const v4StaticRoutes = {
    'v4/home': 'index',
    'v4/detail': 'detail',
    'v4/episode': 'episode',
    'v4/completed': 'completed'
};

Object.entries(v4StaticRoutes).forEach(([route, file]) => {
    const filePath = path.join(__dirname, `../public/v4/${file}.html`);
    app.get(`/${route}`, (req, res) => res.sendFile(filePath));
    app.get(`/${route}.html`, (req, res) => res.sendFile(filePath));
});

// V5 static pages (Anoboy)
const v5StaticRoutes = {
    'v5/home': 'index',
    'v5/detail': 'detail',
    'v5/episode': 'episode',
    'v5/search': 'search',
    'v5/azlist': 'azlist',
    'v5/anime-list': 'azlist',
    'v5/latest': 'latest',
    'v5/latest-release': 'latest'
};

Object.entries(v5StaticRoutes).forEach(([route, file]) => {
    const filePath = path.join(__dirname, `../public/v5/${file}.html`);
    app.get(`/${route}`, (req, res) => res.sendFile(filePath));
    app.get(`/${route}.html`, (req, res) => res.sendFile(filePath));
});

// V6 static pages (AnimeIndo)
const v6StaticRoutes = {
    'v6/home': 'index',
    'v6/anime-list': 'anime-list',
    'v6/detail': 'detail',
    'v6/episode': 'episode',
    'v6/genres': 'genres',
    'v6/movies': 'movies',
    'v6/genre': 'genre',
    'v6/search': 'search'
};

Object.entries(v6StaticRoutes).forEach(([route, file]) => {
    const filePath = path.join(__dirname, `../public/v6/${file}.html`);
    app.get(`/${route}`, (req, res) => res.sendFile(filePath));
    app.get(`/${route}.html`, (req, res) => res.sendFile(filePath));
});

// V7 static pages (Nekopoi)
const v7StaticRoutes = {
    'v7/home': 'index',
    'v7/detail': 'detail',
    'v7/episode': 'episode',
    'v7/search': 'search',
    'v7/list': 'list'
};

Object.entries(v7StaticRoutes).forEach(([route, file]) => {
    const filePath = path.join(__dirname, `../public/v7/${file}.html`);
    app.get(`/${route}`, (req, res) => res.sendFile(filePath));
    app.get(`/${route}.html`, (req, res) => res.sendFile(filePath));
});

// Route for anime-terbaru page (V2 only)
app.get('/anime-terbaru', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v1/anime-list.html'));
});
app.get('/anime-terbaru.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v1/anime-list.html'));
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

app.get('/api/v4/anichin/completed', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        console.log(`[V4] Anichin API - Completed request (page ${page})`);
        const data = await anichinScraper.scrapeCompleted(page);
        res.json({
            status: 'success',
            data: data,
            total: Array.isArray(data?.list) ? data.list.length : 0
        });
    } catch (error) {
        console.error('[V4] Anichin API - Completed error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch completed list',
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

app.get('/api/v4/anichin/episode', async (req, res) => {
    try {
        const slug = req.query.slug;
        if (!slug) {
            return res.status(400).json({
                status: 'error',
                message: 'Parameter slug wajib diisi',
                data: null
            });
        }
        console.log(`[V4] Anichin API - Episode request for: ${slug}`);
        const data = await anichinScraper.scrapeEpisode(slug);
        res.json(data);
    } catch (error) {
        console.error(`[V4] Anichin API - Episode error for ${req.query.slug}:`, error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch episode data',
            data: null
        });
    }
});

// ==================== API V5 - ANOBOY ====================

app.get('/api/v5/anoboy/home', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        console.log(`[V5] Anoboy API - Homepage request (page ${page})`);
        const data = await anoboyScraper.scrapeHomepage(page);
        res.json(data);
    } catch (error) {
        console.error('[V5] Anoboy API - Homepage error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch homepage data',
            data: {
                latest_releases: [],
                recommendations: [],
                pagination: {}
            }
        });
    }
});

app.get('/api/v5/anoboy/latest', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        console.log(`[V5] Anoboy API - Latest Release request for page: ${page}`);
        const data = await anoboyScraper.scrapeLatestRelease(page);
        res.json(data);
    } catch (error) {
        console.error(`[V5] Anoboy API - Latest Release error:`, error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch latest release',
            data: { current_page: 1, anime_list: [], total: 0, has_next_page: false, next_page: null }
        });
    }
});

app.get('/api/v5/anoboy/ongoing', async (req, res) => {
    try {
        console.log('[V5] Anoboy API - Ongoing anime request');
        const data = await anoboyScraper.scrapeOngoing();
        res.json({
            status: 'success',
            data: data,
            total: data.length
        });
    } catch (error) {
        console.error('[V5] Anoboy API - Ongoing error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch ongoing anime',
            data: []
        });
    }
});

app.get('/api/v5/anoboy/detail/:slug(*)', async (req, res) => {
    try {
        const { slug } = req.params;
        console.log(`[V5] Anoboy API - Detail request for: ${slug}`);
        const data = await anoboyScraper.scrapeAnimeDetail(slug);
        res.json(data);
    } catch (error) {
        console.error(`[V5] Anoboy API - Detail error for ${req.params.slug}:`, error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch anime detail',
            data: null
        });
    }
});

app.get('/api/v5/anoboy/episode/:slug(*)', async (req, res) => {
    try {
        const { slug } = req.params;
        console.log(`[V5] Anoboy API - Episode request for: ${slug}`);
        const data = await anoboyScraper.scrapeEpisode(slug);
        res.json(data);
    } catch (error) {
        console.error(`[V5] Anoboy API - Episode error for ${req.params.slug}:`, error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch episode data',
            data: null
        });
    }
});

app.get('/api/v5/anoboy/search', async (req, res) => {
    try {
        const keyword = req.query.q || req.query.keyword || req.query.search;
        if (!keyword) {
            return res.status(400).json({
                status: 'error',
                message: 'Parameter q/keyword wajib diisi',
                data: null
            });
        }
        console.log(`[V5] Anoboy API - Search request for: ${keyword}`);
        const data = await anoboyScraper.scrapeSearch(keyword);
        res.json(data);
    } catch (error) {
        console.error(`[V5] Anoboy API - Search error:`, error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to search anime',
            data: { keyword: '', results: [], total: 0 }
        });
    }
});

app.get('/api/v5/anoboy/azlist', async (req, res) => {
    try {
        const letter = (req.query.letter || req.query.show || 'A').toUpperCase();
        console.log(`[V5] Anoboy API - A-Z List request for letter: ${letter}`);
        const data = await anoboyScraper.scrapeAZList(letter);
        res.json(data);
    } catch (error) {
        console.error(`[V5] Anoboy API - A-Z List error:`, error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch A-Z list',
            data: { current_letter: 'A', anime_list: [], alphabet_nav: [], total: 0 }
        });
    }
});

// ==================== API V6 - ANIMEINDO ====================

app.get('/api/v6/animeindo/home', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        console.log(`[V6] AnimeIndo API - Home request (page ${page})`);
        const data = await animeIndoScraper.scrapeHomepage(page);
        res.json(data);
    } catch (error) {
        console.error('[V6] AnimeIndo API - Home error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch homepage data',
            data: {
                update_terbaru: [],
                popular: [],
                pagination: {}
            }
        });
    }
});

app.get('/api/v6/animeindo/update-terbaru', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        console.log(`[V6] AnimeIndo API - Update Terbaru request (page ${page})`);
        const data = await animeIndoScraper.scrapeUpdateTerbaru(page);
        res.json(data);
    } catch (error) {
        console.error('[V6] AnimeIndo API - Update Terbaru error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch latest updates',
            data: {
                current_page: 1,
                updates: [],
                pagination: {}
            }
        });
    }
});

app.get('/api/v6/animeindo/popular', async (req, res) => {
    try {
        console.log('[V6] AnimeIndo API - Popular request');
        const data = await animeIndoScraper.scrapePopular();
        res.json(data);
    } catch (error) {
        console.error('[V6] AnimeIndo API - Popular error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch popular anime',
            data: {
                popular: [],
                total: 0
            }
        });
    }
});

app.get('/api/v6/animeindo/anime-list', async (req, res) => {
    try {
        const letter = (req.query.letter || req.query.l || 'ALL').toString();
        console.log(`[V6] AnimeIndo API - Anime List request (letter: ${letter})`);
        const data = await animeIndoScraper.scrapeAnimeList(letter);
        res.json(data);
    } catch (error) {
        console.error('[V6] AnimeIndo API - Anime List error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch anime list',
            data: {
                letter: 'ALL',
                total: 0,
                sections: [],
                anime_list: [],
                available_letters: []
            }
        });
    }
});

app.get('/api/v6/animeindo/detail/:slug(*)', async (req, res) => {
    try {
        const slug = req.params.slug;
        console.log(`[V6] AnimeIndo API - Detail request for: ${slug}`);
        const data = await animeIndoScraper.scrapeAnimeDetail(slug);
        res.json(data);
    } catch (error) {
        console.error('[V6] AnimeIndo API - Detail error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch anime detail',
            data: null
        });
    }
});

app.get('/api/v6/animeindo/episode/:slug(*)', async (req, res) => {
    try {
        const slug = req.params.slug;
        console.log(`[V6] AnimeIndo API - Episode request for: ${slug}`);
        const data = await animeIndoScraper.scrapeEpisode(slug);
        res.json(data);
    } catch (error) {
        console.error('[V6] AnimeIndo API - Episode error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch episode data',
            data: null
        });
    }
});

app.get('/api/v6/animeindo/genres', async (req, res) => {
    try {
        console.log('[V6] AnimeIndo API - Genres request');
        const data = await animeIndoScraper.scrapeGenreList();
        res.json(data);
    } catch (error) {
        console.error('[V6] AnimeIndo API - Genres error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch genre list',
            data: {
                total: 0,
                genres: []
            }
        });
    }
});

app.get('/api/v6/animeindo/genres/:slug(*)', async (req, res) => {
    try {
        const slug = req.params.slug;
        const page = parseInt(req.query.page, 10) || 1;
        console.log(`[V6] AnimeIndo API - Genre detail request (${slug}, page ${page})`);
        const data = await animeIndoScraper.scrapeGenreDetail(slug, page);
        res.json(data);
    } catch (error) {
        console.error('[V6] AnimeIndo API - Genre detail error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch genre detail',
            data: {
                genre: '',
                slug: '',
                current_page: 1,
                anime_list: [],
                pagination: {}
            }
        });
    }
});

app.get('/api/v6/animeindo/movies', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        console.log(`[V6] AnimeIndo API - Movie list request (page ${page})`);
        const data = await animeIndoScraper.scrapeMovieList(page);
        res.json(data);
    } catch (error) {
        console.error('[V6] AnimeIndo API - Movie list error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch movie list',
            data: {
                current_page: 1,
                movies: [],
                pagination: {}
            }
        });
    }
});

app.get('/api/v6/animeindo/search', async (req, res) => {
    try {
        const query = req.query.q || req.query.keyword || req.query.search;
        if (!query) {
            return res.status(400).json({
                status: 'error',
                message: 'Parameter q keyword wajib diisi',
                data: {
                    keyword: '',
                    total: 0,
                    results: []
                }
            });
        }
        console.log(`[V6] AnimeIndo API - Search request for: ${query}`);
        const data = await animeIndoScraper.scrapeSearch(query);
        res.json(data);
    } catch (error) {
        console.error('[V6] AnimeIndo API - Search error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to search anime',
            data: {
                keyword: '',
                total: 0,
                results: []
            }
        });
    }
});

// ==================== API V7 - NEKOPOI ====================

app.get('/api/v7/nekopoi/home', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        console.log(`[V7] Nekopoi API - Home request (page ${page})`);
        
        // Fetch 2 pages at once for better content density
        const data1 = await nekopoiScraper.scrapeHomepage(page);
        const data2 = await nekopoiScraper.scrapeHomepage(page + 1);
        
        if (data1.status === 'success' && data2.status === 'success') {
            // Combine episodes from both pages
            const allEpisodes = [
                ...(data1.data.episodes || []),
                ...(data2.data.episodes || [])
            ];
            
            res.json({
                status: 'success',
                data: {
                    episodes: allEpisodes,
                    currentPage: page,
                    hasNextPage: data2.data.hasNextPage || false,
                    hasPrevPage: data1.data.hasPrevPage || false,
                    totalPagesFetched: 2
                }
            });
        } else {
            // Fallback to single page if double fetch fails
            const fallbackData = data1.status === 'success' ? data1 : data2;
            res.json(fallbackData);
        }
    } catch (error) {
        console.error('[V7] Nekopoi API - Home error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch homepage data',
            data: {
                episodes: [],
                currentPage: 1,
                hasNextPage: false,
                hasPrevPage: false
            }
        });
    }
});

app.get('/api/v7/nekopoi/detail/:slug(*)', async (req, res) => {
    try {
        const slug = req.params.slug;
        console.log(`[V7] Nekopoi API - Detail request for: ${slug}`);
        const data = await nekopoiScraper.scrapeAnimeDetail(slug);
        res.json(data);
    } catch (error) {
        console.error('[V7] Nekopoi API - Detail error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch anime detail',
            data: null
        });
    }
});

app.get('/api/v7/nekopoi/episode/:slug(*)', async (req, res) => {
    try {
        const slug = req.params.slug;
        console.log(`[V7] Nekopoi API - Episode request for: ${slug}`);
        const data = await nekopoiScraper.scrapeEpisode(slug);
        res.json(data);
    } catch (error) {
        console.error('[V7] Nekopoi API - Episode error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch episode',
            data: null
        });
    }
});

app.get('/api/v7/nekopoi/search', async (req, res) => {
    try {
        const query = req.query.q || req.query.query || '';
        if (!query) {
            return res.status(400).json({
                status: 'error',
                message: 'Parameter q (query) is required',
                data: {
                    query: '',
                    results: [],
                    totalResults: 0
                }
            });
        }
        console.log(`[V7] Nekopoi API - Search request for: ${query}`);
        const data = await nekopoiScraper.scrapeSearch(query);
        res.json(data);
    } catch (error) {
        console.error('[V7] Nekopoi API - Search error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to search',
            data: {
                query: '',
                results: [],
                totalResults: 0
            }
        });
    }
});

app.get('/api/v7/nekopoi/hentai-list', async (req, res) => {
    try {
        const letter = req.query.letter;

        if (letter) {
            console.log(`[V7] Nekopoi API - Hentai list request for letter: ${letter}`);
            const data = await nekopoiScraper.scrapeHentaiListByLetter(letter);
            res.json(data);
        } else {
            console.log('[V7] Nekopoi API - Full hentai list request');
            const data = await nekopoiScraper.scrapeHentaiList();
            res.json(data);
        }
    } catch (error) {
        console.error('[V7] Nekopoi API - Hentai list error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch hentai list',
            data: null
        });
    }
});

// Test endpoint to check if streaming URL can be downloaded
app.post('/api/v7/nekopoi/test-download', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                status: 'error',
                message: 'URL is required'
            });
        }

        console.log('[V7] Testing download for URL:', url);

        const axios = require('axios');
        const testResults = {
            url,
            canDownload: false,
            method: null,
            contentType: null,
            contentLength: null,
            error: null,
            details: []
        };

        // Test 1: Direct fetch with basic headers
        try {
            console.log('[V7] Test 1: Direct fetch with basic headers');
            const response = await axios.head(url, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                }
            });

            const contentType = response.headers['content-type'] || '';
            const isVideoContent = contentType.includes('video/') ||
                                  contentType.includes('application/octet-stream') ||
                                  contentType.includes('binary/octet-stream');

            testResults.details.push({
                test: 'Direct fetch (basic)',
                success: true,
                status: response.status,
                contentType: contentType,
                contentLength: response.headers['content-length'],
                isVideoContent: isVideoContent,
                note: isVideoContent ? 'Valid video content-type' : 'Not a video content-type (likely HTML page)'
            });

            if (response.status === 200 && isVideoContent) {
                testResults.canDownload = true;
                testResults.method = 'direct-basic';
                testResults.contentType = contentType;
                testResults.contentLength = response.headers['content-length'];
            }
        } catch (error) {
            testResults.details.push({
                test: 'Direct fetch (basic)',
                success: false,
                error: error.message
            });
        }

        // Test 2: Fetch with referer
        if (!testResults.canDownload) {
            try {
                console.log('[V7] Test 2: Fetch with referer');
                const response = await axios.head(url, {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': 'https://nekopoi.care/',
                        'Origin': 'https://nekopoi.care'
                    }
                });

                const contentType = response.headers['content-type'] || '';
                const isVideoContent = contentType.includes('video/') ||
                                      contentType.includes('application/octet-stream') ||
                                      contentType.includes('binary/octet-stream');

                testResults.details.push({
                    test: 'Fetch with referer',
                    success: true,
                    status: response.status,
                    contentType: contentType,
                    contentLength: response.headers['content-length'],
                    isVideoContent: isVideoContent,
                    note: isVideoContent ? 'Valid video content-type' : 'Not a video content-type (likely HTML page)'
                });

                if (response.status === 200 && isVideoContent) {
                    testResults.canDownload = true;
                    testResults.method = 'with-referer';
                    testResults.contentType = contentType;
                    testResults.contentLength = response.headers['content-length'];
                }
            } catch (error) {
                testResults.details.push({
                    test: 'Fetch with referer',
                    success: false,
                    error: error.message
                });
            }
        }

        // Test 3: Check if it's a video file
        const urlLower = url.toLowerCase();
        const isVideoFile = /\.(mp4|mkv|avi|webm|m3u8)(\?|$)/i.test(urlLower);
        testResults.details.push({
            test: 'Video file extension check',
            isVideoFile,
            extension: isVideoFile ? urlLower.match(/\.(mp4|mkv|avi|webm|m3u8)/i)?.[0] : null
        });

        // Test 4: Check domain restrictions
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname;
            const knownStreamingDomains = ['fembed', 'streamtape', 'doodstream', 'iframe', 'myvidplay'];
            const isStreamingDomain = knownStreamingDomains.some(d => domain.includes(d));

            testResults.details.push({
                test: 'Domain check',
                domain,
                isStreamingDomain,
                note: isStreamingDomain ? 'This is a streaming embed domain (not downloadable)' : 'Not a known streaming embed domain'
            });

            if (isStreamingDomain) {
                testResults.canDownload = false;
                testResults.error = 'Streaming embed domains cannot be downloaded directly';
            }
        } catch (error) {
            testResults.details.push({
                test: 'Domain check',
                success: false,
                error: error.message
            });
        }

        // Final verdict
        if (!testResults.canDownload && !testResults.error) {
            // Check if it's likely a HTML page
            const hasHtmlResponse = testResults.details.some(d =>
                d.contentType && d.contentType.includes('text/html')
            );

            if (hasHtmlResponse) {
                testResults.error = 'URL returns HTML page, not a direct video file. This is likely a player embed page.';
            } else {
                testResults.error = 'Unable to download: Not a valid video URL';
            }
        }

        console.log('[V7] Test results:', JSON.stringify(testResults, null, 2));

        res.json({
            status: 'success',
            data: testResults
        });

    } catch (error) {
        console.error('[V7] Test download error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Proxy endpoint for downloading streaming URLs
app.get('/api/v7/nekopoi/proxy-download', async (req, res) => {
    try {
        const url = req.query.url;

        if (!url) {
            return res.status(400).json({
                status: 'error',
                message: 'URL parameter is required'
            });
        }

        console.log('[V7] Proxying download for URL:', url);

        const axios = require('axios');

        // Try to fetch the video
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://nekopoi.care/',
            }
        });

        // Set appropriate headers
        res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }
        res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Pipe the video stream to response
        response.data.pipe(res);

        response.data.on('error', (error) => {
            console.error('[V7] Proxy stream error:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    status: 'error',
                    message: 'Streaming error: ' + error.message
                });
            }
        });

    } catch (error) {
        console.error('[V7] Proxy download error:', error);
        if (!res.headersSent) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }
});


// ==================== API V8 - KUSONIME ====================

// GET /api/v8/kusonime/home - Get Kusonime homepage
app.get('/api/v8/kusonime/home', async (req, res) => {
    try {
        console.log('[V9] Kusonime API - Home request');
        const data = await kusonimeScraper.scrapeHome();
        res.json(data);
    } catch (error) {
        console.error('[V9] Kusonime API - Home error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch Kusonime homepage',
            data: null
        });
    }
});

// GET /api/v8/kusonime/detail/:slug - Get anime detail
app.get('/api/v8/kusonime/detail/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        console.log(`[V9] Kusonime API - Detail request for: ${slug}`);
        const data = await kusonimeScraper.scrapeDetail(slug);
        res.json(data);
    } catch (error) {
        console.error('[V9] Kusonime API - Detail error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch anime detail',
            data: null
        });
    }
});

// GET /api/v8/kusonime/search - Search anime
app.get('/api/v8/kusonime/search', async (req, res) => {
    try {
        const keyword = req.query.q || req.query.keyword;

        if (!keyword) {
            return res.status(400).json({
                status: 'error',
                message: 'Keyword parameter is required',
                data: null
            });
        }

        console.log(`[V9] Kusonime API - Search request for: ${keyword}`);
        const data = await kusonimeScraper.scrapeSearch(keyword);
        res.json(data);
    } catch (error) {
        console.error('[V9] Kusonime API - Search error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to search anime',
            data: null
        });
    }
});

// ====================
// HLS Conversion API
// ====================

// Convert video to HLS
app.post('/api/hls/convert', async (req, res) => {
    try {
        const { videoUrl, episodeId, quality } = req.body;

        if (!videoUrl || !episodeId) {
            return res.status(400).json({
                status: 'error',
                message: 'videoUrl and episodeId are required'
            });
        }

        console.log('HLS Conversion Request:', { videoUrl, episodeId, quality: quality || 'auto' });

        // Create HLS session with quality info
        const session = await hlsService.createHLS(videoUrl, episodeId, quality);

        res.json({
            status: 'success',
            message: 'HLS conversion started',
            data: {
                sessionId: session.sessionId,
                playlistUrl: session.playlistUrl,
                createdAt: session.createdAt
            }
        });

    } catch (error) {
        console.error('HLS Conversion Error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Failed to convert video to HLS'
        });
    }
});

// Serve HLS playlist
app.get('/api/hls/:sessionId/playlist.m3u8', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = hlsService.getSession(sessionId);

        if (!session) {
            return res.status(404).send('Session not found');
        }

        // Update session access time
        hlsService.updateSessionAccess(sessionId);

        const playlistPath = path.join(session.hlsDir, 'playlist.m3u8');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(playlistPath);

    } catch (error) {
        console.error('Error serving playlist:', error);
        res.status(500).send('Error serving playlist');
    }
});

// Serve HLS segments
app.get('/api/hls/:sessionId/:segment', async (req, res) => {
    try {
        const { sessionId, segment } = req.params;
        const session = hlsService.getSession(sessionId);

        if (!session) {
            return res.status(404).send('Session not found');
        }

        // Update session access time
        hlsService.updateSessionAccess(sessionId);

        const segmentPath = path.join(session.hlsDir, segment);
        res.setHeader('Content-Type', 'video/MP2T');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.sendFile(segmentPath);

    } catch (error) {
        console.error('Error serving segment:', error);
        res.status(500).send('Error serving segment');
    }
});

// Close HLS session
app.post('/api/hls/close/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const result = await hlsService.closeSession(sessionId);

        res.json({
            status: 'success',
            message: result.message
        });

    } catch (error) {
        console.error('Error closing session:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to close session'
        });
    }
});

// Get active sessions (debug endpoint)
app.get('/api/hls/sessions', (req, res) => {
    const sessions = hlsService.getActiveSessions();
    res.json({
        status: 'success',
        data: {
            count: sessions.length,
            sessions: sessions.map(s => ({
                sessionId: s.sessionId,
                episodeId: s.episodeId,
                active: s.active,
                createdAt: new Date(s.createdAt).toISOString(),
                lastAccess: new Date(s.lastAccess).toISOString()
            }))
        }
    });
});

// ==============================
// Auratail.vip API Routes (V9)
// ==============================

// Auratail Homepage
app.get('/api/v9/auratail/home', async (req, res) => {
    try {
        console.log('[V9] Scraping Auratail homepage...');
        const data = await auratailScraper.scrapeHome();
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /home:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Auratail Anime Detail
app.get('/api/v9/auratail/anime/:animeId/:slug', async (req, res) => {
    try {
        const { animeId, slug } = req.params;
        console.log(`[V9] Scraping Auratail anime detail: ${animeId}/${slug}`);
        const data = await auratailScraper.scrapeDetail(animeId, slug);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /anime:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Auratail Episode Detail
app.get('/api/v9/auratail/episode/:animeId/:slug/:episodeNum', async (req, res) => {
    try {
        const { animeId, slug, episodeNum } = req.params;
        console.log(`[V9] Scraping Auratail episode: ${animeId}/${slug}/episode/${episodeNum}`);
        const data = await auratailScraper.scrapeEpisode(animeId, slug, episodeNum);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /episode:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Auratail Search
app.get('/api/v9/auratail/search', async (req, res) => {
    try {
        const { q, page = 1 } = req.query;
        if (!q) {
            return res.status(400).json({ status: 'error', message: 'Query parameter "q" is required' });
        }
        console.log(`[V9] Searching Auratail for: ${q}`);
        const data = await auratailScraper.scrapeSearch(q, page);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /search:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Auratail Anime List
app.get('/api/v9/auratail/anime-list', async (req, res) => {
    try {
        const { page = 1, status = '', type = '', order = 'update' } = req.query;
        console.log(`[V9] Fetching Auratail anime list...`);
        const data = await auratailScraper.scrapeAnimeList(page, status, type, order);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /anime-list:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Auratail Genres
app.get('/api/v9/auratail/genres', async (req, res) => {
    try {
        console.log('[V9] Fetching Auratail genres...');
        const data = await auratailScraper.scrapeGenreList();
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /genres:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Auratail Genre Detail
app.get('/api/v9/auratail/genre/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const { page = 1, orderBy = 'ascending' } = req.query;
        console.log(`[V9] Fetching Auratail genre: ${slug}`);
        const data = await auratailScraper.scrapeGenre(slug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /genre:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Auratail Types
app.get('/api/v9/auratail/types', async (req, res) => {
    try {
        console.log('[V9] Fetching Auratail types...');
        const data = await auratailScraper.scrapeTypeList();
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /types:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Auratail Type Detail
app.get('/api/v9/auratail/type/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const { page = 1, orderBy = 'ascending' } = req.query;
        console.log(`[V9] Fetching Auratail type: ${slug}`);
        const data = await auratailScraper.scrapeType(slug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /type:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Auratail Batch Download
app.get('/api/v9/auratail/batch/:animeId/:slug/:range', async (req, res) => {
    try {
        const { animeId, slug, range } = req.params;
        console.log(`[V9] Scraping Auratail batch: ${animeId}/${slug}/batch/${range}`);
        const data = await auratailScraper.scrapeBatch(animeId, slug, range);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /batch:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).send('<h1>404 - Halaman tidak ditemukan</h1><a href="/v1/home">Kembali ke Beranda</a>');
});

// Auto-cleanup cache images older than 1 hour
async function cleanOldCacheImages() {
    try {
        const files = await fs.readdir(CACHE_DIR);
        const now = Date.now();
        const MAX_AGE = 60 * 60 * 1000; // 1 hour in milliseconds
        let deletedCount = 0;
        let deletedSize = 0;

        for (const file of files) {
            const filePath = path.join(CACHE_DIR, file);
            try {
                const stats = await fs.stat(filePath);
                const age = now - stats.mtime.getTime();

                if (age > MAX_AGE) {
                    deletedSize += stats.size;
                    await fs.unlink(filePath);
                    deletedCount++;
                }
            } catch (error) {
                console.error(`[Cache Cleanup] Error processing ${file}:`, error.message);
            }
        }

        if (deletedCount > 0) {
            const deletedMB = (deletedSize / (1024 * 1024)).toFixed(2);
            console.log(`🧹 [Cache Cleanup] Deleted ${deletedCount} old images (${deletedMB} MB)`);
        }
    } catch (error) {
        console.error('[Cache Cleanup] Error:', error.message);
    }
}

// Run cleanup every 10 minutes
setInterval(cleanOldCacheImages, 10 * 60 * 1000);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 AnimMe Server berjalan di http://0.0.0.0:${PORT}`);
    console.log(`📺 Multi-Server Support:`);
    console.log(`   ├─ V1 (Otakudesu): /api/...`);
    console.log(`   ├─ V2 (Samehadaku): /api/v2/...`);
    console.log(`   ├─ V3 (Kuramanime): /api/v3/kuramanime/...`);
    console.log(`   ├─ V4 (Anichin): /api/v4/anichin/...`);
    console.log(`   ├─ V5 (Anoboy): /api/v5/anoboy/...`);
    console.log(`   ├─ V6 (AnimeIndo): /api/v6/animeindo/...`);
    console.log(`   ├─ V7 (Nekopoi): /api/v7/nekopoi/...`);
    console.log(`   ├─ V8 (Kusonime): /api/v8/kusonime/...
   └─ V9 (Auratail): /api/v9/auratail/...`);
    console.log(`🌐 Buka browser dan akses: http://167.253.159.235:${PORT}`);
    console.log(`🧹 Auto-cleanup cache: Images older than 1 hour will be deleted every 10 minutes\n`);

    // Run initial cleanup on server start
    cleanOldCacheImages();
});
