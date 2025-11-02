const axios = require('axios');
const cheerio = require('cheerio');

async function testLatestRelease() {
    try {
        console.log('Testing Latest Release page...\n');

        // Test page 1
        console.log('=== PAGE 1 ===');
        const url1 = 'https://anoboy.be/anime/?status=&type=&order=update';
        const response1 = await axios.get(url1, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $1 = cheerio.load(response1.data);

        console.log('1. Container Analysis:');
        const containers = ['.listupd', '.bs', 'article'];
        containers.forEach(selector => {
            const found = $1(selector);
            if (found.length > 0) {
                console.log(`   ✓ Found ${found.length} elements with: ${selector}`);
            }
        });

        console.log('\n2. First 3 Anime:');
        $1('.listupd .bs, .listupd article.bs').slice(0, 3).each((i, el) => {
            const $el = $1(el);
            const title = $el.find('h2').first().text().trim();
            const url = $el.find('a').first().attr('href');
            const image = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
            const type = $el.find('.type').text().trim();

            console.log(`   ${i + 1}. ${title}`);
            console.log(`      URL: ${url}`);
            console.log(`      Type: ${type || 'N/A'}`);
        });

        // Check pagination
        console.log('\n3. Pagination:');
        const paginationSelectors = ['.pagination', '.hpage', '.wp-pagenavi', '.page-numbers'];
        paginationSelectors.forEach(selector => {
            const found = $1(selector);
            if (found.length > 0) {
                console.log(`   ✓ Found pagination with: ${selector}`);
                console.log(`      HTML: ${found.html()?.substring(0, 200)}...`);
            }
        });

        // Check page links
        console.log('\n4. Page Links:');
        $1('a.page-numbers, .pagination a, .hpage a').each((i, el) => {
            const $el = $1(el);
            const text = $el.text().trim();
            const href = $el.attr('href');
            if (i < 5) {
                console.log(`   ${text}: ${href}`);
            }
        });

        // Get total pages
        console.log('\n5. Total Pages Info:');
        const lastPageLink = $1('a.page-numbers').last();
        console.log(`   Last page link: ${lastPageLink.attr('href')}`);
        console.log(`   Last page text: ${lastPageLink.text()}`);

        // Test page 2
        console.log('\n\n=== PAGE 2 ===');
        const url2 = 'https://anoboy.be/anime/?page=2&status=&type=&order=update';
        const response2 = await axios.get(url2, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $2 = cheerio.load(response2.data);

        console.log('First 3 Anime on Page 2:');
        $2('.listupd .bs, .listupd article.bs').slice(0, 3).each((i, el) => {
            const $el = $2(el);
            const title = $el.find('h2').first().text().trim();
            console.log(`   ${i + 1}. ${title}`);
        });

        // Total anime
        const totalPage1 = $1('.listupd .bs, .listupd article.bs').length;
        const totalPage2 = $2('.listupd .bs, .listupd article.bs').length;
        console.log(`\nTotal anime: Page 1 = ${totalPage1}, Page 2 = ${totalPage2}`);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testLatestRelease();
