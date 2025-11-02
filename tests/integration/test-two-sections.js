const { fetchPage, BASE_URL } = require('./server/anoboy/helpers');

async function testTwoSections() {
    try {
        const $ = await fetchPage(BASE_URL);

        console.log('=== ANALYZING BOTH .listupd SECTIONS ===\n');

        $('.listupd').each((i, section) => {
            const $sec = $(section);

            // Get section heading
            const $parent = $sec.parent();
            const heading = $parent.prev('h2').text().trim() ||
                           $parent.find('h2').first().text().trim() ||
                           $sec.prev('h2').text().trim() ||
                           'No heading';

            const items = $sec.find('.bs').length;
            const classes = $sec.attr('class');

            console.log(`Section ${i + 1}:`);
            console.log(`  Heading: "${heading}"`);
            console.log(`  Classes: "${classes}"`);
            console.log(`  Items: ${items}`);

            // Get first 2 titles
            $sec.find('.bs').slice(0, 2).each((j, item) => {
                const title = $(item).find('h2').first().text().trim();
                console.log(`    [${j + 1}] ${title}`);
            });

            console.log('');
        });

        // Check for any headings before .listupd
        console.log('=== CHECKING SECTION HEADINGS ===\n');
        $('h2, h3').each((i, heading) => {
            const text = $(heading).text().trim();
            const $next = $(heading).next();
            const nextClass = $next.attr('class') || '';

            if (nextClass.includes('listupd') || text.toLowerCase().includes('latest') ||
                text.toLowerCase().includes('reco') || text.toLowerCase().includes('popular')) {
                console.log(`"${text}" -> Next element: .${nextClass}`);
            }
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testTwoSections();
