const { fetchPage, BASE_URL, cleanText } = require('./server/anoboy/helpers');

async function testRecommendation() {
    try {
        const $ = await fetchPage(BASE_URL);

        console.log('=== FINDING RECOMMENDATION SECTION ===\n');

        // Find "Recommendation" heading
        let $recoSection = null;
        $('h2, h3').each((i, heading) => {
            const text = $(heading).text().trim();
            if (text.toLowerCase().includes('reco')) {
                console.log(`Found heading: "${text}"`);
                $recoSection = $(heading).next();
                console.log('Next element class:', $recoSection.attr('class'));
                console.log('Next element tag:', $recoSection.prop('tagName'));
            }
        });

        if ($recoSection && $recoSection.length > 0) {
            console.log('\n=== RECOMMENDATION ITEMS ===\n');

            const items = $recoSection.find('.bs, article.bs');
            console.log('Total items:', items.length);

            items.slice(0, 5).each((i, item) => {
                const $item = $(item);
                const $link = $item.find('a').first();
                const $img = $item.find('img').first();

                const title = cleanText($item.find('h2').first().text());
                const url = $link.attr('href') || '';
                const image = $img.attr('src') || $img.attr('data-src') || '';
                const type = cleanText($item.find('.type').first().text());
                const score = cleanText($item.find('.score, .rating').first().text());

                console.log(`[${i + 1}] ${title}`);
                console.log(`    URL: ${url}`);
                console.log(`    Image: ${image}`);
                console.log(`    Type: ${type}`);
                console.log(`    Score: ${score}`);
                console.log('');
            });
        } else {
            console.log('\nRecommendation section container not found.');

            // Try alternative: second .listupd
            console.log('\n=== CHECKING SECOND .listupd AS RECOMMENDATION ===\n');
            const $secondList = $('.listupd').eq(1);
            if ($secondList.length > 0) {
                console.log('Second .listupd found!');
                const items = $secondList.find('.bs');
                console.log('Items:', items.length);

                items.slice(0, 3).each((i, item) => {
                    const title = cleanText($(item).find('h2').first().text());
                    const url = $(item).find('a').first().attr('href');
                    console.log(`  [${i + 1}] ${title}`);
                    console.log(`      ${url}`);
                });
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testRecommendation();
