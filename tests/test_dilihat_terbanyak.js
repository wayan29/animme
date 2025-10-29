const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://v8.kuramanime.tel';

async function debugDilihatTerbanyak() {
    try {
        console.log('Fetching Kuramanime homepage...\n');
        const { data } = await axios.get(BASE_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        
        console.log('=== ANALYZING SIDEBAR SECTIONS ===\n');
        
        // Check all sidebar sections
        $('.product__sidebar__view').each((i, sidebar) => {
            const $sidebar = $(sidebar);
            const sidebarTitle = $sidebar.find('h5, h4, .section-title h5, .section-title h4').first().text().trim();
            
            console.log(`\nSidebar ${i + 1}: "${sidebarTitle}"`);
            console.log('----------------------------------------');
            
            if (sidebarTitle.includes('Dilihat Terbanyak')) {
                console.log('✓ Found "Dilihat Terbanyak" section!\n');
                
                // Try different selectors for items
                console.log('Testing selectors:');
                console.log(`  .product__sidebar__view__item count: ${$sidebar.find('.product__sidebar__view__item').length}`);
                console.log(`  .filter__gallery count: ${$sidebar.find('.filter__gallery').length}`);
                console.log(`  .product__item count: ${$sidebar.find('.product__item').length}`);
                
                // Get first item and analyze structure
                const $firstItem = $sidebar.find('.product__sidebar__view__item').first();
                if ($firstItem.length > 0) {
                    console.log('\n--- First Item HTML Structure ---');
                    console.log($firstItem.html());
                    console.log('\n--- Testing poster selectors on first item ---');
                    
                    // Try various selectors for image
                    const selectors = [
                        '.product__sidebar__view__item__pic',
                        '.product__sidebar__view__item__pic img',
                        'img',
                        '[data-setbg]',
                        '.view__pic',
                        '.ep__pic'
                    ];
                    
                    selectors.forEach(sel => {
                        const $found = $firstItem.find(sel);
                        if ($found.length > 0) {
                            console.log(`\n  ✓ ${sel}:`);
                            console.log(`    - Found: ${$found.length} elements`);
                            console.log(`    - data-setbg: ${$found.attr('data-setbg')}`);
                            console.log(`    - src: ${$found.attr('src')}`);
                            console.log(`    - style: ${$found.attr('style')}`);
                        } else {
                            console.log(`  ✗ ${sel}: not found`);
                        }
                    });
                    
                    // Check parent/wrapper
                    const $parent = $firstItem.parent();
                    console.log('\n--- Parent Element ---');
                    console.log(`Parent tag: ${$parent.prop('tagName')}`);
                    console.log(`Parent class: ${$parent.attr('class')}`);
                    
                    if ($parent.prop('tagName') === 'A') {
                        console.log(`Parent href: ${$parent.attr('href')}`);
                    }
                }
                
                // List all items
                console.log('\n--- All Items ---');
                $sidebar.find('.product__sidebar__view__item').each((j, el) => {
                    const $el = $(el);
                    const title = $el.find('h5').text().trim();
                    const $link = $el.closest('a').length > 0 ? $el.closest('a') : $el.find('a');
                    const href = $link.attr('href');
                    
                    // Try to find image in multiple ways
                    const poster1 = $el.find('.product__sidebar__view__item__pic').attr('data-setbg');
                    const poster2 = $el.find('[data-setbg]').first().attr('data-setbg');
                    const poster3 = $el.parent().find('[data-setbg]').first().attr('data-setbg');
                    
                    console.log(`\n${j + 1}. ${title}`);
                    console.log(`   URL: ${href}`);
                    console.log(`   Poster (method 1): ${poster1 || 'NOT FOUND'}`);
                    console.log(`   Poster (method 2): ${poster2 || 'NOT FOUND'}`);
                    console.log(`   Poster (method 3 - parent): ${poster3 || 'NOT FOUND'}`);
                });
            }
        });
        
        console.log('\n\n=== DONE ===');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugDilihatTerbanyak();
