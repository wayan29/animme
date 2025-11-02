const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://anoboy.be';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function testScrapeHome() {
    try {
        console.log('Fetching anoboy.be homepage...');

        const response = await axios.get(BASE_URL, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            timeout: 15000
        });

        const $ = cheerio.load(response.data);

        console.log('\n=== TESTING ANOBOY.BE SCRAPING ===\n');

        // Test 1: Find anime list containers
        console.log('1. Looking for anime list containers...');
        const containers = [
            '.listupd',
            '.home_index',
            '.post',
            'article',
            '.bsx',
            '.bs',
            '.animepost',
            '.excstf'
        ];

        containers.forEach(selector => {
            const found = $(selector);
            if (found.length > 0) {
                console.log(`   ✓ Found ${found.length} elements with selector: ${selector}`);

                // Show first element structure
                const first = found.first();
                console.log(`     - Classes: ${first.attr('class')}`);
                console.log(`     - Has image: ${first.find('img').length > 0}`);
                console.log(`     - Has link: ${first.find('a').length > 0}`);
            }
        });

        // Test 2: Find latest anime posts
        console.log('\n2. Extracting latest anime posts...');
        const posts = [];

        $('.listupd .bs, .excstf article').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const $img = $el.find('img').first();
            const $title = $el.find('.tt, .title, h2, h3').first();
            const $episode = $el.find('.epx, .bt .epx, .type').first();

            const post = {
                title: $title.text().trim() || $link.attr('title') || '',
                url: $link.attr('href') || '',
                image: $img.attr('src') || $img.attr('data-src') || '',
                episode: $episode.text().trim() || '',
                type: $el.find('.type').text().trim() || ''
            };

            if (post.title && post.url) {
                posts.push(post);
            }
        });

        console.log(`   Found ${posts.length} anime posts`);
        if (posts.length > 0) {
            console.log('\n   Sample (first 3):');
            posts.slice(0, 3).forEach((post, i) => {
                console.log(`   ${i + 1}. ${post.title}`);
                console.log(`      Episode: ${post.episode}`);
                console.log(`      URL: ${post.url}`);
                console.log(`      Image: ${post.image.substring(0, 80)}...`);
            });
        }

        // Test 3: Find ongoing/trending section
        console.log('\n3. Looking for ongoing/trending section...');
        const ongoingSelectors = ['.widget', '.sidebar', '#sidebar'];
        ongoingSelectors.forEach(selector => {
            const found = $(selector);
            if (found.length > 0) {
                console.log(`   ✓ Found ${found.length} sidebar/widget elements`);
                const titles = found.find('h2, h3, h4').map((i, el) => $(el).text().trim()).get();
                console.log(`     Widget titles: ${titles.slice(0, 5).join(', ')}`);
            }
        });

        // Test 4: Check pagination
        console.log('\n4. Checking pagination...');
        const pagination = $('.pagination, .hpage, .paginationjs');
        if (pagination.length > 0) {
            console.log(`   ✓ Found pagination`);
            const links = pagination.find('a').map((i, el) => $(el).text().trim()).get();
            console.log(`     Links: ${links.join(', ')}`);
        }

        console.log('\n=== SCRAPING TEST COMPLETE ===\n');

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
        }
    }
}

testScrapeHome();
