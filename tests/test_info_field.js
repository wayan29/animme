const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://v8.kuramanime.tel';

async function debugInfoField() {
    try {
        const url = `${BASE_URL}/anime/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga`;
        console.log(`Fetching: ${url}\n`);
        
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        
        console.log('=== ANALYZING INFO SECTION ===\n');
        
        // Check for anime__details__widget
        const $widget = $('.anime__details__widget');
        console.log(`Found .anime__details__widget: ${$widget.length}\n`);
        
        if ($widget.length > 0) {
            console.log('Widget HTML structure (first 1500 chars):');
            console.log($widget.html().substring(0, 1500));
            console.log('...\n\n');
        }
        
        // Test current selector
        console.log('=== Testing Current Selector ===');
        console.log('Selector: .anime__details__widget ul li\n');
        
        $('.anime__details__widget ul li').each((i, el) => {
            const $el = $(el);
            const label = $el.find('span').first().text().trim().replace(':', '');
            const value = $el.clone().children().remove().end().text().trim();
            
            console.log(`Item ${i + 1}:`);
            console.log(`  Label: "${label}"`);
            console.log(`  Value: "${value}"`);
            console.log(`  Full text: "${$el.text().trim()}"`);
            console.log('');
        });
        
        // Try alternative selectors
        console.log('\n=== Trying Alternative Selectors ===\n');
        
        const selectors = [
            '.anime__details__widget .row .col-lg-6 ul li',
            '.anime__details__widget .col-lg-6:first-child ul li',
            '.anime__details__text ul li',
            '.anime__details__content ul li'
        ];
        
        selectors.forEach(selector => {
            const count = $(selector).length;
            if (count > 0) {
                console.log(`✓ ${selector}: ${count} items`);
                $(selector).slice(0, 3).each((i, el) => {
                    const text = $(el).text().trim();
                    console.log(`  ${i + 1}. ${text.substring(0, 80)}...`);
                });
                console.log('');
            } else {
                console.log(`✗ ${selector}: not found\n`);
            }
        });
        
        console.log('\n=== DONE ===');
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

debugInfoField();
