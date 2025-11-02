/**
 * Test detail page episode list pagination
 * The issue might be in the detail page, not the episode page
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function testDetailEpisodes() {
    let browser;
    try {
        // Detail page URL for the same anime
        const baseUrl = 'https://v8.kuramanime.tel/anime/4039/cang-lan-jue-2';

        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: '/snap/bin/chromium',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        console.log('='.repeat(80));
        console.log('Testing Detail Page Episode List');
        console.log('='.repeat(80));

        console.log(`\nLoading: ${baseUrl}`);
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        const html = await page.content();
        const $ = cheerio.load(html);

        // Check for episode popover
        const $episodeBtn = $('#episodeLists');
        console.log(`\nEpisode button found: ${$episodeBtn.length > 0}`);

        if ($episodeBtn.length > 0) {
            const popoverContent = $episodeBtn.attr('data-content');
            if (popoverContent) {
                console.log('Popover content length:', popoverContent.length);

                // Parse popover
                const $popover = cheerio.load(popoverContent);
                const episodes = [];

                $popover('a[href*="/episode/"]').each((i, el) => {
                    const $el = $popover(el);
                    const episodeHref = $el.attr('href');
                    const episodeTitle = $el.text().trim();
                    if (episodeHref && episodeTitle) {
                        episodes.push(episodeTitle);
                    }
                });

                console.log(`\nTotal episodes in popover: ${episodes.length}`);
                if (episodes.length > 0) {
                    console.log(`First 5: ${episodes.slice(0, 5).join(', ')}`);
                    console.log(`Last 5: ${episodes.slice(-5).join(', ')}`);
                }
            } else {
                console.log('No popover content found');
            }
        }

        // Check for fallback episode list
        const fallbackEpisodes = [];
        $('.anime__details__episodes a').each((i, el) => {
            const $el = $(el);
            const episodeText = $el.text().trim();
            if (episodeText) {
                fallbackEpisodes.push(episodeText);
            }
        });

        console.log(`\nFallback episodes: ${fallbackEpisodes.length}`);
        if (fallbackEpisodes.length > 0) {
            console.log(`First 5: ${fallbackEpisodes.slice(0, 5).join(', ')}`);
        }

        await browser.close();
        console.log('\n' + '='.repeat(80));

    } catch (error) {
        console.error('Test failed:', error.message);
        if (browser) await browser.close();
        process.exit(1);
    }
}

testDetailEpisodes();
