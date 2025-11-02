const { fetchPage, BASE_URL } = require('./server/anoboy/helpers');

async function testRecommendation() {
    try {
        const $ = await fetchPage(BASE_URL);
        
        console.log('=== SEARCHING FOR RECOMMENDATION ===\n');
        
        // Check all possible widget containers
        const widgets = [
            { name: 'aside .widget', sel: 'aside .widget' },
            { name: '.sidebar .widget', sel: '.sidebar .widget' },
            { name: '.reco', sel: '.reco' },
            { name: '.widget_senction', sel: '.widget_senction' }
        ];
        
        for (const w of widgets) {
            const $widgets = $(w.sel);
            if ($widgets.length > 0) {
                console.log(`Found ${$widgets.length} elements with selector: ${w.name}`);
                
                $widgets.each((i, widget) => {
                    const $w = $(widget);
                    const title = $w.find('.widget-title, h2, h3').first().text().trim();
                    const classes = $w.attr('class');
                    console.log(`  [${i}] Class: "${classes}" | Title: "${title}"`);
                    
                    // If this looks like recommendation
                    if (title.toLowerCase().includes('reco') || classes?.includes('reco')) {
                        console.log('  ^^^ RECOMMENDATION FOUND!');
                        const items = $w.find('.bs, article.bs');
                        console.log(`  Items count: ${items.length}`);
                        
                        items.slice(0, 3).each((j, item) => {
                            const $item = $(item);
                            const itemTitle = $item.find('h2, .tt').first().text().trim();
                            const link = $item.find('a').first().attr('href');
                            const img = $item.find('img').first().attr('src') || $item.find('img').first().attr('data-src');
                            console.log(`    [${j}] ${itemTitle}`);
                            console.log(`        Link: ${link}`);
                            console.log(`        Image: ${img}`);
                        });
                    }
                });
            }
        }
        
        // Also check for widget_senction specifically
        console.log('\n=== CHECKING .widget_senction ===');
        $('.widget_senction').each((i, el) => {
            const $el = $(el);
            const heading = $el.find('h2').first().text().trim();
            console.log(`Section ${i}: "${heading}"`);
            console.log('  Class:', $el.attr('class'));
            
            const items = $el.find('.bs');
            console.log(`  Items: ${items.length}`);
            
            if (items.length > 0) {
                items.slice(0, 2).each((j, item) => {
                    const title = $(item).find('h2').first().text().trim();
                    console.log(`    - ${title}`);
                });
            }
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testRecommendation();
