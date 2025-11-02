const { fetchPage, BASE_URL } = require('./server/anoboy/helpers');

async function testHomeStructure() {
    try {
        console.log('Fetching:', BASE_URL);
        
        const $ = await fetchPage(BASE_URL);
        
        // Check for pagination/next button
        console.log('\n=== PAGINATION ===');
        const $nextBtn = $('.hpage a.r');
        console.log('Next button (.hpage a.r) found:', $nextBtn.length);
        if ($nextBtn.length > 0) {
            console.log('Next button text:', $nextBtn.first().text().trim());
            console.log('Next button href:', $nextBtn.first().attr('href'));
        }
        
        // Check all pagination elements
        $('.hpage a').each((i, el) => {
            const text = $(el).text().trim();
            const href = $(el).attr('href');
            console.log(`  Page [${i}] "${text}" -> ${href}`);
        });
        
        // Check for Recommendation section
        console.log('\n=== RECOMMENDATION SECTION ===');
        
        // Check sidebar widgets
        $('aside .widget').each((i, widget) => {
            const $widget = $(widget);
            const title = $widget.find('.widget-title, h2, h3').first().text().trim();
            console.log(`Widget ${i}: "${title}"`);
            
            if (title.toLowerCase().includes('reco')) {
                console.log('  ^ RECOMMENDATION WIDGET FOUND!');
                console.log('  Class:', $widget.attr('class'));
                
                // Check items inside
                $widget.find('.bs').slice(0, 3).each((j, item) => {
                    const $item = $(item);
                    const itemTitle = $item.find('h2').first().text().trim();
                    const link = $item.find('a').first().attr('href');
                    console.log(`    [${j}] ${itemTitle}`);
                });
            }
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testHomeStructure();
