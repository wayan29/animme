const axios = require('axios');
const cheerio = require('cheerio');

async function testSearch() {
    try {
        console.log('Fetching search page for "spy x"...\n');
        const response = await axios.get('https://anoboy.be/?s=spy+x', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);

        console.log('=== SEARCH PAGE ANALYSIS ===\n');

        // Test 1: Find search results container
        console.log('1. Search Results Container:');
        const containers = ['.listupd', '.bs', 'article'];
        containers.forEach(selector => {
            const found = $(selector);
            if (found.length > 0) {
                console.log(`   ✓ Found ${found.length} elements with: ${selector}`);
            }
        });

        // Test 2: Extract first 3 results
        console.log('\n2. Search Results Details:');
        $('.listupd .bs, .listupd article.bs').slice(0, 3).each((i, el) => {
            const $el = $(el);

            // Try different title selectors
            const titleSelectors = ['.tt', 'h2', 'h3', '.title', 'a[title]'];
            let title = '';
            titleSelectors.forEach(sel => {
                const found = $el.find(sel).first();
                if (found.length > 0 && !title) {
                    title = found.text().trim();
                    console.log(`   Result ${i + 1}:`);
                    console.log(`      Title (${sel}): ${title}`);
                }
            });

            // Get link
            const url = $el.find('a').first().attr('href');
            console.log(`      URL: ${url}`);

            // Get image
            const $img = $el.find('img').first();
            const image = $img.attr('src') || $img.attr('data-src');
            console.log(`      Image: ${image?.substring(0, 60)}...`);

            // Get type
            const type = $el.find('.type').text().trim();
            if (type) console.log(`      Type: ${type}`);

            // Get score
            const score = $el.find('.score, .rating').text().trim();
            if (score) console.log(`      Score: ${score}`);

            console.log('');
        });

        // Test 3: Check total results
        console.log('3. Total Results:');
        const totalResults = $('.listupd .bs, .listupd article.bs').length;
        console.log(`   Found ${totalResults} anime in search results\n`);

        // Test 4: Check HTML structure of first result
        console.log('4. First Result HTML Structure:');
        const firstResult = $('.listupd .bs, .listupd article.bs').first();
        if (firstResult.length > 0) {
            console.log('   Classes:', firstResult.attr('class'));
            console.log('   Children elements:');
            firstResult.children().each((i, child) => {
                const $child = $(child);
                console.log(`      - ${child.tagName} ${$child.attr('class') ? '.' + $child.attr('class') : ''}`);
            });
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testSearch();
