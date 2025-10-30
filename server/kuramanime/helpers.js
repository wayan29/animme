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
        const varMatches = envContent.matchAll(/(\w+):\s*['\"]([^'\"]+)['\"]/g);
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

module.exports = {
    extractStreamingUrls,
    extractStreamingUrlsForServer,
    getImageHash,
    proxyImageUrl,
    getImageUrlMap,
    extractSlug,
    extractAnimeId,
    BASE_URL
};
