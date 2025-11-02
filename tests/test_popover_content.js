/**
 * Test popover content to see if episodes are truncated
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');

async function testPopoverContent() {
    let browser;
    try {
        const url = 'https://v8.kuramanime.tel/anime/4039/cang-lan-jue-2';

        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: '/snap/bin/chromium',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        console.log('='.repeat(80));
        console.log('Testing Popover Content for Missing Episodes');
        console.log('='.repeat(80));

        console.log(`\nLoading: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

        const html = await page.content();
        const $ = cheerio.load(html);

        // Get popover content
        const $episodeBtn = $('#episodeLists');
        if ($episodeBtn.length === 0) {
            console.log('No episode button found!');
            await browser.close();
            return;
        }

        const popoverContent = $episodeBtn.attr('data-content');
        if (!popoverContent) {
            console.log('No popover content found!');
            await browser.close();
            return;
        }

        // Save popover content to file for inspection
        fs.writeFileSync('/tmp/popover_content.html', popoverContent);
        console.log('Popover content saved to /tmp/popover_content.html');
        console.log(`Popover content length: ${popoverContent.length} characters`);

        // Parse popover content
        const $popover = cheerio.load(popoverContent);
        const episodes = [];

        $popover('a[href*="/episode/"]').each((i, el) => {
            const $el = $popover(el);
            const episodeHref = $el.attr('href');
            const episodeTitle = $el.text().trim();

            if (episodeHref && episodeTitle) {
                // Extract episode number
                const epMatch = episodeHref.match(/\/episode\/(\d+)/);
                const epNum = epMatch ? parseInt(epMatch[1]) : null;

                episodes.push({
                    title: episodeTitle,
                    href: episodeHref,
                    number: epNum
                });
            }
        });

        console.log(`\nTotal episodes found: ${episodes.length}`);

        // Sort by episode number
        const numberedEpisodes = episodes.filter(ep => ep.number !== null).sort((a, b) => a.number - b.number);

        console.log(`\nEpisodes with numbers: ${numberedEpisodes.length}`);

        if (numberedEpisodes.length > 0) {
            console.log(`First episode: ${numberedEpisodes[0].title} (Ep ${numberedEpisodes[0].number})`);
            console.log(`Last episode: ${numberedEpisodes[numberedEpisodes.length - 1].title} (Ep ${numberedEpisodes[numberedEpisodes.length - 1].number})`);

            // Check for gaps
            console.log('\nChecking for missing episodes...');
            const allNumbers = numberedEpisodes.map(ep => ep.number);
            const min = Math.min(...allNumbers);
            const max = Math.max(...allNumbers);

            const missing = [];
            for (let i = min; i <= max; i++) {
                if (!allNumbers.includes(i)) {
                    missing.push(i);
                }
            }

            if (missing.length > 0) {
                console.log(`  ✗ Missing episodes: ${missing.join(', ')}`);
            } else {
                console.log(`  ✓ No gaps from Ep ${min} to Ep ${max}`);
            }

            // But check if we have ALL episodes up to the latest
            console.log(`\n  Latest episode: ${max}`);
            console.log(`  Expected episodes: 1 to ${max}`);
            console.log(`  Found episodes: ${numberedEpisodes.length}`);
            console.log(`  Missing count: ${max - numberedEpisodes.length + missing.length}`);
        }

        // Show all episodes
        console.log('\nAll episodes in popover:');
        episodes.forEach((ep, i) => {
            console.log(`  ${i + 1}. ${ep.title} (${ep.href})`);
        });

        await browser.close();
        console.log('\n' + '='.repeat(80));

    } catch (error) {
        console.error('Test failed:', error.message);
        if (browser) await browser.close();
        process.exit(1);
    }
}

testPopoverContent();
