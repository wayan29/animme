const { fetchPage, BASE_URL } = require('./server/anoboy/helpers');

async function testFullStructure() {
    try {
        const dollar = await fetchPage(BASE_URL);

        console.log('=== MAIN CONTENT SECTIONS ===\n');

        // Check main content sections
        dollar('#main .widget_senction, #content .widget_senction, .bixbox .widget_senction').each((i, section) => {
            const sec = dollar(section);
            const heading = sec.find('h2, .widget-title').first().text().trim();
            const items = sec.find('.bs, article').length;
            console.log(`Section ${i}: "${heading}"`);
            console.log(`  Items: ${items}`);
            console.log(`  Class: ${sec.attr('class')}`);
        });

        console.log('\n=== CHECKING FOR "Latest Release" ON HOMEPAGE ===');
        const latestSection = dollar('.listupd');
        console.log('Latest release (.listupd) found:', latestSection.length);
        if (latestSection.length > 0) {
            const items = latestSection.find('.bs').length;
            console.log('  Items:', items);
        }

        console.log('\n=== PAGINATION ON HOMEPAGE ===');
        const pagination = dollar('.hpage');
        console.log('Pagination (.hpage) found:', pagination.length);
        if (pagination.length > 0) {
            const next = pagination.find('a.r');
            const links = pagination.find('a');
            console.log('  Total links:', links.length);
            console.log('  Next button found:', next.length);
            if (next.length > 0) {
                console.log('  Next href:', next.attr('href'));
            }
        }

        console.log('\n=== ALL H2 HEADINGS ON PAGE ===');
        dollar('h2').slice(0, 10).each((i, h2) => {
            const text = dollar(h2).text().trim();
            console.log(`  ${i}. "${text}"`);
        });

        console.log('\n=== SIDEBAR CONTENT ===');
        dollar('aside, .sidebar, #sidebar').each((i, sidebar) => {
            console.log(`Sidebar ${i} class:`, dollar(sidebar).attr('class'));
            dollar(sidebar).find('.widget, section').slice(0, 5).each((j, widget) => {
                const title = dollar(widget).find('h2, h3, .widget-title').first().text().trim();
                console.log(`  Widget ${j}: "${title}"`);
            });
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testFullStructure();
