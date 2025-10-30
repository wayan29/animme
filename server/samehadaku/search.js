const axios = require('axios');
const cheerio = require('cheerio');
const cloudscraper = require('cloudscraper');
const { BASE_URL, proxyImageUrl, extractSlug } = require('./helpers');

// Scrape Search using cloudscraper (optimized for Cloudflare)
async function scrapeSearch(keyword) {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(keyword)}`;
        let html = null;

        // Primary: Try cloudscraper (khusus untuk bypass Cloudflare)
        try {
            console.log('[V2] Attempting search with cloudscraper:', keyword);
            html = await cloudscraper.get({
                uri: url,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': BASE_URL,
                }
            });
            console.log('[V2] Successfully loaded page with cloudscraper');
        } catch (cloudscraperError) {
            // Fallback: Try axios dengan headers yang lengkap
            console.log('[V2] Cloudscraper failed, trying axios fallback:', cloudscraperError.message);
            try {
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
                html = data;
                console.log('[V2] Successfully loaded page with axios');
            } catch (axiosError) {
                console.error('[V2] Both cloudscraper and axios failed:', axiosError.message);
                throw new Error(`Failed to fetch search results: ${axiosError.message}`);
            }
        }

        const $ = cheerio.load(html);
        const results = [];

        $('.post-show ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('.dtla h2 a');
            const $img = $el.find('.thumb img');

            const title = $link.text().trim();
            if (!title) return; // Skip if no title

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
