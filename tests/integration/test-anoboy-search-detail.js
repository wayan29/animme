const axios = require('axios');
const cheerio = require('cheerio');

async function testSearchDetail() {
    try {
        const response = await axios.get('https://anoboy.be/?s=spy+x', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);

        console.log('=== DETAILED ANALYSIS OF FIRST RESULT ===\n');

        const $firstResult = $('.listupd .bs, .bs').first();

        console.log('1. Testing .tt selector:');
        const $ttAll = $firstResult.find('.tt');
        console.log(`   Found ${$ttAll.length} .tt elements`);

        $ttAll.each((i, el) => {
            const $el = $(el);
            console.log(`\n   .tt[${i}]:`);
            console.log(`      text(): "${$el.text()}"`);
            console.log(`      html(): ${$el.html()?.substring(0, 100)}`);
            console.log(`      Children count: ${$el.children().length}`);

            // Check for nested elements
            $el.children().each((j, child) => {
                console.log(`         Child ${j}: <${child.tagName}> - "${$(child).text()}"`);
            });
        });

        console.log('\n2. Testing .tt:first selector:');
        const $ttFirst = $firstResult.find('.tt').first();
        console.log(`   text(): "${$ttFirst.text()}"`);
        console.log(`   Direct text only: "${$ttFirst.contents().filter(function() { return this.nodeType === 3; }).text()}"`);

        console.log('\n3. Testing h2 selector:');
        const $h2 = $firstResult.find('h2').first();
        if ($h2.length > 0) {
            console.log(`   text(): "${$h2.text()}"`);
            console.log(`   html(): ${$h2.html()?.substring(0, 100)}`);
        } else {
            console.log('   No h2 found');
        }

        console.log('\n4. Testing link title attribute:');
        const $link = $firstResult.find('a').first();
        console.log(`   title attr: "${$link.attr('title')}"`);
        console.log(`   aria-label: "${$link.attr('aria-label')}"`);

        console.log('\n5. HTML Structure of .tt element:');
        if ($ttFirst.length > 0) {
            console.log($ttFirst.html());
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testSearchDetail();
