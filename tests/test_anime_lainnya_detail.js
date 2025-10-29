const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://v8.kuramanime.tel';

async function debugAnimeLainnya() {
    try {
        const url = `${BASE_URL}/anime/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga`;
        console.log(`Fetching: ${url}\n`);
        
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        
        console.log('=== ANALYZING "ANIME LAINNYA" SECTION ===\n');
        
        // Find the section title
        let $animeLainnyaSection = null;
        
        $('.section-title').each((i, el) => {
            const $el = $(el);
            const titleText = $el.find('h5, h4').text().trim();
            
            if (titleText === 'Anime Lainnya') {
                console.log('✓ Found "Anime Lainnya" section!\n');
                $animeLainnyaSection = $el.parent();
                
                console.log('Section details:');
                console.log(`  Parent tag: ${$animeLainnyaSection.prop('tagName')}`);
                console.log(`  Parent class: ${$animeLainnyaSection.attr('class')}`);
                console.log('');
                
                // Look for common anime card patterns
                const patterns = [
                    '.product__item',
                    '.product__sidebar__view__item',
                    '.anime__item',
                    '.card',
                    '[class*="item"]',
                    '.col-lg-3',
                    '.col-lg-4',
                    '.col-md-6',
                    'a[href*="/anime/"]'
                ];
                
                console.log('Testing selectors within this section:');
                patterns.forEach(pattern => {
                    const count = $animeLainnyaSection.find(pattern).length;
                    if (count > 0) {
                        console.log(`  ✓ ${pattern}: ${count} items`);
                    }
                });
                
                console.log('\n--- Full Section HTML (first 2000 chars) ---');
                const sectionHtml = $animeLainnyaSection.html();
                console.log(sectionHtml.substring(0, 2000));
                console.log('...\n');
                
                // Try to find all links within the section
                console.log('--- All anime links in section ---');
                $animeLainnyaSection.find('a[href*="/anime/"]').each((j, link) => {
                    const $link = $(link);
                    const href = $link.attr('href');
                    const text = $link.text().trim();
                    const poster = $link.attr('data-setbg') || $link.find('[data-setbg]').attr('data-setbg');
                    
                    console.log(`\n${j + 1}. ${text}`);
                    console.log(`   URL: ${href}`);
                    console.log(`   Poster: ${poster || 'NOT FOUND'}`);
                    console.log(`   Link class: ${$link.attr('class')}`);
                    
                    // Show parent structure
                    const $parent = $link.parent();
                    console.log(`   Parent: ${$parent.prop('tagName')}.${$parent.attr('class')}`);
                    
                    // Show child elements
                    if ($link.children().length > 0) {
                        console.log(`   Children: ${$link.children().length} elements`);
                        $link.children().each((k, child) => {
                            console.log(`     - ${$(child).prop('tagName')}.${$(child).attr('class')}`);
                        });
                    }
                });
                
                return false; // Stop after finding the section
            }
        });
        
        if (!$animeLainnyaSection) {
            console.log('⚠ "Anime Lainnya" section not found!');
            
            // Show all section titles
            console.log('\n--- All Section Titles on Page ---');
            $('.section-title').each((i, el) => {
                const title = $(el).find('h5, h4').text().trim();
                console.log(`${i + 1}. "${title}"`);
            });
        }
        
        console.log('\n=== DONE ===');
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

debugAnimeLainnya();
