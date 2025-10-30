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

module.exports = {
    BASE_URL,
    PLAYER_AJAX_URL,
    getImageHash,
    proxyImageUrl,
    getImageUrlMap,
    extractSlug,
    fetchAjaxPlayerIframe
};
