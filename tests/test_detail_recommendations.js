const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://v8.kuramanime.tel';

async function debugDetailPage() {
    try {
        const url = `${BASE_URL}/anime/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga`;
        console.log(`Fetching detail page: ${url}\n`);
        
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        
        console.log('=== ANALYZING DETAIL PAGE STRUCTURE ===\n');
        
        // Check for recommendation sections
        console.log('Looking for recommendation sections...\n');
        
        // Common selectors for recommendations
        const sectionSelectors = [
            '.section-title',
            'h4',
            'h5',
            '.anime__details__title'
        ];
        
        sectionSelectors.forEach(selector => {
            $(selector).each((i, el) => {
                const text = $(el).text().trim();
                if (text.toLowerCase().includes('lain') || 
                    text.toLowerCase().includes('rekomendasi') || 
                    text.toLowerCase().includes('similar') ||
                    text.toLowerCase().includes('related')) {
                    console.log(`✓ Found section: "${text}" with selector: ${selector}`);
                    console.log(`  Parent class: ${$(el).parent().attr('class')}`);
                    console.log('');
                }
            });
        });
        
        // Check for product items (common anime card structure)
        console.log('\n=== PRODUCT SECTIONS ===\n');
        
        $('.product__page, .trending__product, .product__sidebar').each((i, section) => {
            const $section = $(section);
            const sectionTitle = $section.find('.section-title h4, .section-title h5, h4, h5').first().text().trim();
            const itemCount = $section.find('.product__item').length;
            
            if (itemCount > 0) {
                console.log(`Section ${i + 1}: "${sectionTitle}"`);
                console.log(`  Items found: ${itemCount}`);
                console.log(`  Section class: ${$section.attr('class')}`);
                console.log('');
            }
        });
        
        // Look for "Anime Lainnya" or similar sections
        console.log('\n=== SEARCHING FOR "ANIME LAINNYA" ===\n');
        
        $('*').each((i, el) => {
            const $el = $(el);
            const text = $el.contents().filter(function() {
                return this.nodeType === 3; // Text nodes only
            }).text().trim();
            
            if (text === 'Anime Lainnya' || text === 'Rekomendasi' || text === 'Related Anime') {
                console.log(`✓ Found text: "${text}"`);
                console.log(`  Element: ${$el.prop('tagName')}`);
                console.log(`  Class: ${$el.attr('class')}`);
                console.log(`  Parent: ${$el.parent().prop('tagName')}.${$el.parent().attr('class')}`);
                
                // Get the parent section
                const $section = $el.closest('.product__page, .trending__product, .row, section');
                console.log(`  Section class: ${$section.attr('class')}`);
                console.log(`  Items in section: ${$section.find('.product__item').length}`);
                console.log('');
                
                // Show first item structure
                const $firstItem = $section.find('.product__item').first();
                if ($firstItem.length > 0) {
                    console.log('  --- First Item HTML ---');
                    console.log($firstItem.html());
                    console.log('');
                }
            }
        });
        
        // Alternative: Check if there's a section after the episode list
        console.log('\n=== SECTIONS AFTER EPISODE LIST ===\n');
        
        const $episodeSection = $('.anime__details__episodes').parent();
        const $nextSections = $episodeSection.nextAll();
        
        console.log(`Found ${$nextSections.length} sections after episodes`);
        
        $nextSections.each((i, section) => {
            const $section = $(section);
            const sectionTitle = $section.find('.section-title h4, .section-title h5, h4, h5').first().text().trim();
            const itemCount = $section.find('.product__item').length;
            
            if (itemCount > 0) {
                console.log(`\nSection ${i + 1}: "${sectionTitle}"`);
                console.log(`  Items: ${itemCount}`);
                console.log(`  Section HTML preview:`);
                console.log($section.html().substring(0, 500) + '...');
            }
        });
        
        // Check for any product__item on the page
        console.log('\n\n=== ALL PRODUCT ITEMS ON PAGE ===\n');
        const allItems = $('.product__item').length;
        console.log(`Total product items found: ${allItems}`);
        
        if (allItems > 0) {
            $('.product__item').slice(0, 3).each((i, item) => {
                const $item = $(item);
                const title = $item.find('h5 a, .product__item__text h5 a').first().text().trim();
                const href = $item.find('a').first().attr('href');
                const poster = $item.find('.product__item__pic').attr('data-setbg');
                
                console.log(`\n${i + 1}. ${title}`);
                console.log(`   URL: ${href}`);
                console.log(`   Poster: ${poster ? '✓ Found' : '✗ Missing'}`);
            });
        }
        
        console.log('\n\n=== DONE ===');
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

debugDetailPage();
