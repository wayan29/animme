/**
 * Test pagination detection by manually checking multiple pages
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function testPaginationDetection() {
    let browser;
    try {
        const baseUrl = 'https://v8.kuramanime.tel/anime/4039/cang-lan-jue-2/episode/18';

        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: '/snap/bin/chromium',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        console.log('='.repeat(80));
        console.log('Testing Pagination Detection');
        console.log('='.repeat(80));

        // Test pages 1, 2, 3
        for (let pageNum = 1; pageNum <= 3; pageNum++) {
            const url = pageNum === 1 ? baseUrl : `${baseUrl}?page=${pageNum}`;
            console.log(`\n--- Page ${pageNum}: ${url} ---`);

            try {
                await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
                const html = await page.content();
                const $ = cheerio.load(html);

                // Count episodes
                const episodes = [];
                $('.anime__details__episodes #animeEpisodes a.ep-button').each((i, el) => {
                    const $el = $(el);
                    const episodeText = $el.text().trim();
                    episodes.push(episodeText);
                });

                console.log(`Episodes found: ${episodes.length}`);
                if (episodes.length > 0) {
                    console.log(`Episodes: ${episodes.join(', ')}`);
                }

                // Check for pagination elements
                console.log('\nPagination detection:');

                const paginationSelectors = [
                    '.anime__details__episodes .pagination',
                    '.pagination',
                    '.anime__details__episodes nav',
                    'nav.pagination',
                    '.page-link',
                    'a[rel="next"]',
                    'a[rel="prev"]',
                    '.page-item',
                ];

                paginationSelectors.forEach(selector => {
                    const count = $(selector).length;
                    if (count > 0) {
                        console.log(`  ✓ Found ${selector}: ${count} elements`);
                        // Show the HTML of first match
                        if (count > 0) {
                            const html = $(selector).first().html();
                            console.log(`    HTML: ${html ? html.substring(0, 100) : 'empty'}`);
                        }
                    }
                });

                // Check for "next" buttons
                const nextButtons = $('a:contains("Next"), a:contains("Selanjutnya"), a:contains("›"), a:contains("»")');
                if (nextButtons.length > 0) {
                    console.log(`\n  Found potential "Next" buttons: ${nextButtons.length}`);
                    nextButtons.each((i, el) => {
                        const $el = $(el);
                        console.log(`    ${i + 1}. Text: "${$el.text().trim()}" | href: ${$el.attr('href')}`);
                    });
                }

            } catch (error) {
                console.log(`  Error: ${error.message}`);
                break;
            }
        }

        await browser.close();
        console.log('\n' + '='.repeat(80));
        console.log('Pagination detection test complete');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('Test failed:', error.message);
        if (browser) await browser.close();
        process.exit(1);
    }
}

testPaginationDetection();
