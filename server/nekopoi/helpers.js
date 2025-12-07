const crypto = require('crypto');
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://nekopoi.care';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Normalize image URL
function normalizeImageUrl(url) {
    if (!url) return null;
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('/')) return `${BASE_URL}${url}`;
    return url;
}

// Generate hash for image caching
function getImageHash(url) {
    return crypto.createHash('md5').update(url).digest('hex');
}

// Map to store image URL mappings
const imageUrlMap = new Map();

// Proxy image URL through server
function imageProxy(url) {
    const normalizedUrl = normalizeImageUrl(url);
    if (!normalizedUrl || !normalizedUrl.startsWith('http')) {
        return normalizedUrl;
    }
    const hash = getImageHash(normalizedUrl);
    imageUrlMap.set(hash, normalizedUrl);
    return `/img/${hash}`;
}

// Get image URL map (for server.js)
function getImageUrlMap() {
    return imageUrlMap;
}

// Fetch and parse page
async function fetchPage(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': BASE_URL
            },
            timeout: 30000
        });
        return cheerio.load(response.data);
    } catch (error) {
        throw new Error(`Failed to fetch ${url}: ${error.message}`);
    }
}

// Extract slug from URL
function extractSlugFromUrl(url) {
    if (!url) return '';
    const match = url.match(/\/([^\/]+)\/?$/);
    return match ? match[1] : '';
}

// Clean text
function cleanText(text) {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ');
}

// Parse episode number from text
function parseEpisodeNumber(text) {
    const match = text.match(/episode\s*(\d+)/i) || text.match(/ep\s*(\d+)/i) || text.match(/(\d+)/);
    return match ? match[1] : text;
}

module.exports = {
    BASE_URL,
    USER_AGENT,
    normalizeImageUrl,
    getImageHash,
    imageProxy,
    getImageUrlMap,
    fetchPage,
    extractSlugFromUrl,
    cleanText,
    parseEpisodeNumber
};
