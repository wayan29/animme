const axios = require('axios');
const cheerio = require('cheerio');

async function testAZList() {
    try {
        console.log('Fetching A-Z list page...');
        const response = await axios.get('https://anoboy.be/az-list/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);

        console.log('\n=== A-Z LIST PAGE ANALYSIS ===\n');

        // Test 1: Find alphabet filter
        console.log('1. Alphabet Filters:');
        $('.azlistfilm ul li a, .alphabet a, .az-list a').each((i, el) => {
            const text = $(el).text().trim();
            const href = $(el).attr('href');
            if (i < 10) console.log(`   ${text}: ${href}`);
        });

        // Test 2: Find anime list
        console.log('\n2. Anime List Container:');
        const containers = ['.listupd', '.list-anime', '.anime-list', '.bs', 'article'];
        containers.forEach(selector => {
            const found = $(selector);
            if (found.length > 0) {
                console.log(`   ✓ Found ${found.length} elements with: ${selector}`);
            }
        });

        // Test 3: Extract first 5 anime
        console.log('\n3. Sample Anime Data:');
        $('.listupd .bs, article.bs').slice(0, 5).each((i, el) => {
            const $el = $(el);
            const title = $el.find('.tt, h2, h3').text().trim();
            const url = $el.find('a').first().attr('href');
            const image = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');

            console.log(`   ${i + 1}. ${title}`);
            console.log(`      URL: ${url}`);
            console.log(`      Image: ${image?.substring(0, 60)}...`);
        });

        // Test 4: Check current letter indicator
        console.log('\n4. Current Letter/Active Filter:');
        $('.azlistfilm ul li.current a, .alphabet .active, .az-list .active').each((i, el) => {
            console.log(`   Active: ${$(el).text().trim()}`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testAZList();
