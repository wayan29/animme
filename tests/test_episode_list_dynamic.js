/**
 * Test if episode list is loaded dynamically with JavaScript
 */

const puppeteer = require('puppeteer');

async function testDynamicEpisodeList() {
    let browser;
    try {
        const url = 'https://v8.kuramanime.tel/anime/4039/cang-lan-jue-2/episode/18';

        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: '/snap/bin/chromium',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        console.log('='.repeat(80));
        console.log('Testing Dynamic Episode List Loading');
        console.log('='.repeat(80));

        console.log(`\nLoading: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

        // Check initial episode count
        let episodeButtons = await page.$$('.anime__details__episodes #animeEpisodes a.ep-button');
        console.log(`Initial episode buttons: ${episodeButtons.length}`);

        // Take screenshot of episode section
        const episodeSection = await page.$('.anime__details__episodes');
        if (episodeSection) {
            await episodeSection.screenshot({ path: '/tmp/episode_section.png' });
            console.log('Screenshot saved to /tmp/episode_section.png');
        }

        // Check for "Load More" or pagination buttons
        const loadMoreSelectors = [
            'button:contains("Load More")',
            'button:contains("Lihat Lebih")',
            'a:contains("Load More")',
            '.load-more',
            '#loadMore',
            '.btn-load-more'
        ];

        console.log('\nChecking for "Load More" buttons...');
        for (const selector of loadMoreSelectors) {
            try {
                const elements = await page.$$(selector);
                if (elements.length > 0) {
                    console.log(`  ✓ Found: ${selector} (${elements.length} elements)`);
                }
            } catch (e) {
                // Selector might not work in $$ (like :contains)
            }
        }

        // Get all episode-related HTML
        const episodeHTML = await page.evaluate(() => {
            const section = document.querySelector('.anime__details__episodes');
            return section ? section.innerHTML : 'Not found';
        });

        // Look for pagination or AJAX indicators in the HTML
        console.log('\nLooking for pagination/AJAX indicators...');

        const indicators = [
            'data-page',
            'data-total-pages',
            'pagination',
            'page-link',
            'ajax',
            'load-more'
        ];

        indicators.forEach(indicator => {
            if (episodeHTML.toLowerCase().includes(indicator)) {
                console.log(`  ✓ Found indicator: ${indicator}`);
            }
        });

        // Try scrolling to see if it triggers lazy loading
        console.log('\nTrying to scroll to trigger lazy loading...');
        await page.evaluate(() => {
            const section = document.querySelector('.anime__details__episodes');
            if (section) {
                section.scrollIntoView();
                section.scrollTop = section.scrollHeight;
            }
        });

        await page.waitForTimeout(2000);

        episodeButtons = await page.$$('.anime__details__episodes #animeEpisodes a.ep-button');
        console.log(`After scroll episode buttons: ${episodeButtons.length}`);

        // Check if there's a popover or hidden elements
        console.log('\nChecking for popovers/hidden elements...');
        const hiddenEpisodes = await page.evaluate(() => {
            const popoverBtns = document.querySelectorAll('[data-toggle="popover"], [data-content]');
            const results = [];
            popoverBtns.forEach(btn => {
                const content = btn.getAttribute('data-content');
                if (content && content.includes('episode')) {
                    results.push({
                        id: btn.id,
                        class: btn.className,
                        contentLength: content.length
                    });
                }
            });
            return results;
        });

        if (hiddenEpisodes.length > 0) {
            console.log('  Found popovers with episode content:');
            hiddenEpisodes.forEach(h => {
                console.log(`    - ${h.id} (${h.class}): ${h.contentLength} chars`);
            });
        }

        await browser.close();
        console.log('\n' + '='.repeat(80));

    } catch (error) {
        console.error('Test failed:', error.message);
        console.error(error.stack);
        if (browser) await browser.close();
        process.exit(1);
    }
}

testDynamicEpisodeList();
