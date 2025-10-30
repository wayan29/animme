const axios = require('axios');
const cheerio = require('cheerio');
const { BASE_URL, proxyImageUrl, extractSlug } = require('./helpers');

// Scrape Search
async function scrapeSearch(keyword) {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(keyword)}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(data);
        const results = [];

        $('.post-show ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('.dtla h2 a');
            const $img = $el.find('.thumb img');

            const anime = {
                title: $link.text().trim(),
                slug: extractSlug($link.attr('href')),
                poster: proxyImageUrl($img.attr('src')),
                genres: [],
                status: '',
                rating: ''
            };

            results.push(anime);
        });

        return {
            status: 'success',
            data: results
        };
    } catch (error) {
        console.error('Error scraping samehadaku search:', error.message);
        throw error;
    }
}

module.exports = {
    scrapeSearch
};
