const axios = require('axios');
const cheerio = require('cheerio');
const { BASE_URL, proxyImageUrl, extractSlug } = require('./helpers');

// Scrape Search
async function scrapeSearch(keyword) {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(keyword)}`;

        console.log('[V2] Searching Samehadaku for:', keyword);

        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': BASE_URL,
            },
            timeout: 15000
        });

        const $ = cheerio.load(data);
        const results = [];

        $('.post-show ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('.dtla h2 a');
            const $img = $el.find('.thumb img');

            const title = $link.text().trim();
            if (!title) return;

            const anime = {
                title: title,
                slug: extractSlug($link.attr('href')),
                poster: proxyImageUrl($img.attr('src')),
                genres: [],
                status: '',
                rating: ''
            };

            results.push(anime);
        });

        console.log(`[V2] Found ${results.length} results for "${keyword}"`);

        return {
            status: 'success',
            data: results
        };
    } catch (error) {
        console.error('[V2] Error scraping samehadaku search:', error.message);
        throw error;
    }
}

module.exports = {
    scrapeSearch
};
