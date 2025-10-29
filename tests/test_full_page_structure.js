const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://v8.kuramanime.tel';

async function debugFullStructure() {
    try {
        const url = `${BASE_URL}/anime/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga`;
        console.log(`Fetching: ${url}\n`);
        
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        
        console.log('=== ALL MAJOR SECTIONS ===\n');
        
        // Look for all major container sections
        $('section, .container, .row > div[class*="col"]').each((i, section) => {
            const $section = $(section);
            const classes = $section.attr('class');
            const id = $section.attr('id');
            const heading = $section.find('h1, h2, h3, h4, h5').first().text().trim();
            
            if (classes || id || heading) {
                console.log(`Section ${i + 1}:`);
                if (id) console.log(`  ID: ${id}`);
                if (classes) console.log(`  Classes: ${classes}`);
                if (heading) console.log(`  Heading: ${heading}`);
                console.log('');
            }
        });
        
        // Search for "Daftar" or "Episode" in all text
        console.log('\n=== SEARCHING FOR "DAFTAR" OR "EPISODE" TEXT ===\n');
        
        $('*').each((i, el) => {
            const $el = $(el);
            const ownText = $el.contents().filter(function() {
                return this.nodeType === 3;
            }).text().trim();
            
            if (ownText.toLowerCase().includes('daftar') || ownText.toLowerCase().includes('episode')) {
                console.log(`Found: "${ownText}"`);
                console.log(`  Tag: ${$el.prop('tagName')}`);
                console.log(`  Class: ${$el.attr('class')}`);
                console.log(`  ID: ${$el.attr('id')}`);
                
                // Check if there are links nearby
                const nearbyLinks = $el.parent().find('a[href*="/"]').length;
                console.log(`  Nearby links: ${nearbyLinks}`);
                console.log('');
            }
        });
        
        // Check if there's a tab or accordion structure
        console.log('\n=== CHECKING FOR TABS/ACCORDION ===\n');
        
        const tabSelectors = [
            '.nav-tabs',
            '.tabs',
            '[role="tablist"]',
            '.tab-content',
            '.accordion',
            '.collapse'
        ];
        
        tabSelectors.forEach(selector => {
            const count = $(selector).length;
            if (count > 0) {
                console.log(`✓ ${selector}: ${count}`);
                
                // Show first item
                const $first = $(selector).first();
                console.log(`  Preview: ${$first.html().substring(0, 300)}...`);
                console.log('');
            }
        });
        
        // Check for buttons or elements that might load episodes dynamically
        console.log('\n=== CHECKING FOR DYNAMIC LOADING ===\n');
        
        const dynamicSelectors = [
            'button',
            '[data-toggle]',
            '[onclick]',
            '[data-url]',
            '.load-more'
        ];
        
        dynamicSelectors.forEach(selector => {
            const $elements = $(selector);
            if ($elements.length > 0) {
                console.log(`\n${selector}: ${$elements.length} items`);
                $elements.slice(0, 3).each((i, el) => {
                    const $el = $(el);
                    console.log(`  ${i + 1}. Text: ${$el.text().trim()}`);
                    console.log(`     Attributes:`, {
                        'data-toggle': $el.attr('data-toggle'),
                        'data-target': $el.attr('data-target'),
                        'data-url': $el.attr('data-url'),
                        'onclick': $el.attr('onclick')
                    });
                });
            }
        });
        
        // Check script tags for clues
        console.log('\n\n=== CHECKING SCRIPTS FOR EPISODE DATA ===\n');
        
        $('script').each((i, script) => {
            const scriptContent = $(script).html() || '';
            if (scriptContent.includes('episode') || scriptContent.includes('Episode') || scriptContent.includes('daftar')) {
                console.log(`\nScript ${i + 1} (contains episode-related code):`);
                const lines = scriptContent.split('\n').filter(line => 
                    line.toLowerCase().includes('episode') || 
                    line.toLowerCase().includes('daftar')
                ).slice(0, 5);
                lines.forEach(line => console.log(`  ${line.trim()}`));
            }
        });
        
        console.log('\n\n=== DONE ===');
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

debugFullStructure();
