const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { BASE_URL, proxyImageUrl, extractSlug } = require('./helpers');

// Scrape Search using Puppeteer (with fallback to axios)
async function scrapeSearch(keyword) {
    let browser = null;
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(keyword)}`;
        let html = null;

        // Try using Puppeteer first
        try {
            console.log('[V2] Attempting search with Puppeteer:', keyword);
            browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();

            // Set realistic user agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Set timeout and navigate
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

            // Wait for content to load
            await page.waitForSelector('.post-show', { timeout: 10000 }).catch(() => null);

            // Get page content
            html = await page.content();
            await browser.close();
            browser = null;
            console.log('[V2] Successfully loaded page with Puppeteer');
        } catch (puppeteerError) {
            // Fallback to axios if puppeteer fails
            console.log('[V2] Puppeteer failed, trying axios fallback:', puppeteerError.message);
            if (browser) await browser.close();

            try {
                const { data } = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Referer': BASE_URL,
                    },
                    timeout: 10000
                });
                html = data;
                console.log('[V2] Successfully loaded page with axios');
            } catch (axiosError) {
                console.error('[V2] Both Puppeteer and axios failed:', axiosError.message);
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

        return {
            status: 'success',
            data: results
        };
    } catch (error) {
        console.error('[V2] Error scraping samehadaku search:', error.message);
        throw error;
    } finally {
        // Ensure browser is closed
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                console.error('[V2] Error closing browser:', e.message);
            }
        }
    }
}

module.exports = {
    scrapeSearch
};
