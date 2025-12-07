// Kusonime V8 Scraper - Search

const axios = require('axios');
const cheerio = require('cheerio');
const { BASE_URL, proxyImageUrl, extractSlug, cleanText } = require('./helpers');

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

        // Parse search results
        $('.venz ul li, .post, article').each((i, el) => {
            const $el = $(el);

            // Find title and link
            const $titleLink = $el.find('h2 a, .entry-title a, a.series').first();
            const title = cleanText($titleLink.text());
            const href = $titleLink.attr('href');

            // Find image
            const $img = $el.find('img').first();
            const poster = $img.attr('src') || $img.attr('data-src');

            // Extract genres
            const genres = [];
            $el.find('.genre-info a, .cat-links a').each((j, genreEl) => {
                const genre = cleanText($(genreEl).text());
                if (genre && genre !== 'Anime') {
                    genres.push(genre);
                }
            });

            // Extract date
            const releaseDate = cleanText($el.find('.date, time, .post-date').text());

            if (title && href) {
                results.push({
                    title: title,
                    slug: extractSlug(href),
                    poster: proxyImageUrl(poster),
                    genres: genres,
                    release_date: releaseDate || 'Unknown',
                    url: href
                });
            }
        });

        return {
            status: 'success',
            data: {
                keyword: keyword,
                results: results,
                total: results.length
            }
        };
    } catch (error) {
        console.error('[Kusonime] Error scraping search:', error.message);
        throw error;
    }
}

module.exports = {
    scrapeSearch
};
