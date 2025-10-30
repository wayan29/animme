const crypto = require('crypto');

const BASE_URL = 'https://otakudesu.best';

function normalizeImageUrl(url) {
    if (!url) return null;
    if (url.startsWith('//')) {
        return `https:${url}`;
    }
    if (url.startsWith('/')) {
        return `${BASE_URL}${url}`;
    }
    return url;
}

// Helper untuk generate hash dari URL gambar
function getImageHash(url) {
    return crypto.createHash('md5').update(url).digest('hex');
}

// Helper untuk store image URL mapping
const imageUrlMap = new Map();

function proxyImageUrl(url) {
    const normalizedUrl = normalizeImageUrl(url);
    if (!normalizedUrl || !normalizedUrl.startsWith('http')) return normalizedUrl;
    const hash = getImageHash(normalizedUrl);
    imageUrlMap.set(hash, normalizedUrl);
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

module.exports = {
    BASE_URL,
    normalizeImageUrl,
    getImageHash,
    proxyImageUrl,
    getImageUrlMap,
    extractSlug
};
