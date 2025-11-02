const axios = require('axios');
const cheerio = require('cheerio');

const URL = 'https://anoboy.be/kao-ni-denai-kashiwada-san-to-kao-ni-deru-oota-kun-episode-5-subtitle-indonesia/';

async function testEpisode() {
    try {
        console.log('Fetching episode page...');
        const response = await axios.get(URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);

        console.log('\n=== EPISODE PAGE ANALYSIS ===\n');

        // Test 1: Title
        console.log('1. Title:');
        console.log('   .entry-title:', $('.entry-title').text().trim());
        console.log('   h1.title:', $('h1.title').text().trim());

        // Test 2: Anime title
        console.log('\n2. Anime Title:');
        console.log('   .anime-title:', $('.anime-title').text().trim());
        console.log('   .allc a:', $('.allc a').text().trim());
        console.log('   breadcrumb:', $('.breadcrumb a').eq(-2).text().trim());

        // Test 3: Video sources
        console.log('\n3. Video Sources:');
        $('iframe').each((i, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src');
            console.log(`   iframe ${i + 1}:`, src?.substring(0, 80) + '...');
        });

        // Test 4: Download links
        console.log('\n4. Download Links:');
        $('.download-eps li a, .dls li a, .dlx a, .download a').each((i, el) => {
            const text = $(el).text().trim();
            const href = $(el).attr('href');
            if (href) {
                console.log(`   ${i + 1}. ${text}: ${href.substring(0, 60)}...`);
            }
        });

        // Test 5: Navigation
        console.log('\n5. Navigation:');
        console.log('   Prev (.nvs.nvsc a[rel="prev"]):', $('.nvs.nvsc a[rel="prev"]').text().trim());
        console.log('   Next (.nvs.nvsc a[rel="next"]):', $('.nvs.nvsc a[rel="next"]').text().trim());
        console.log('   Prev (.flir a):', $('.flir a').first().text().trim(), $('.flir a').first().attr('href'));
        console.log('   Next (.flir a):', $('.flir a').last().text().trim(), $('.flir a').last().attr('href'));

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testEpisode();
