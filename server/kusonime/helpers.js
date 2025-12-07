// Kusonime V8 Scraper - Helper Functions

const BASE_URL = 'https://kusonime.com';

// Proxy image URL through our server
function proxyImageUrl(imageUrl) {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('data:')) return imageUrl;
    if (imageUrl.startsWith('/')) return `${BASE_URL}${imageUrl}`;

    // Hash the URL for caching
    const hash = require('crypto').createHash('md5').update(imageUrl).digest('hex');
    return `/img/${hash}`;
}

// Get image URL map for proxy
const imageUrlMap = new Map();
function getImageUrlMap() {
    return imageUrlMap;
}

// Extract slug from URL
function extractSlug(url) {
    if (!url) return '';

    // Remove base URL
    url = url.replace(BASE_URL, '');

    // Extract slug from path
    const match = url.match(/\/([^\/]+)\/?$/);
    return match ? match[1] : url.replace(/\//g, '');
}

// Clean text
function cleanText(text) {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ');
}

module.exports = {
    BASE_URL,
    proxyImageUrl,
    getImageUrlMap,
    extractSlug,
    cleanText
};
