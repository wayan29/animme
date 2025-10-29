const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://v8.kuramanime.tel';

async function debugEpisodeList() {
    try {
        const url = `${BASE_URL}/anime/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga`;
        console.log(`Fetching: ${url}\n`);
        
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        
        console.log('=== ANALYZING EPISODE LIST SECTION ===\n');
        
        // Look for sections with "Daftar Episode" or "Episode"
        $('*').each((i, el) => {
            const $el = $(el);
            const text = $el.contents().filter(function() {
                return this.nodeType === 3; // Text nodes only
            }).text().trim();
            
            if (text === 'Daftar Episode' || text === 'Episode List' || text.includes('Episode')) {
                if ($el.prop('tagName') === 'H3' || $el.prop('tagName') === 'H4' || $el.prop('tagName') === 'H5' || $el.hasClass('section-title')) {
                    console.log(`✓ Found section title: "${text}"`);
                    console.log(`  Element: ${$el.prop('tagName')}.${$el.attr('class')}`);
                    console.log(`  Parent: ${$el.parent().prop('tagName')}.${$el.parent().attr('class')}`);
                    console.log('');
                }
            }
        });
        
        // Check common episode list selectors
        console.log('\n=== TESTING EPISODE SELECTORS ===\n');
        
        const selectors = [
            '.anime__details__episodes',
            '.anime__details__episodes a',
            '.episode-list',
            '.episode__item',
            '[class*="episode"]',
            'a[href*="/episode/"]'
        ];
        
        selectors.forEach(selector => {
            const count = $(selector).length;
            if (count > 0) {
                console.log(`✓ ${selector}: ${count} items`);
            }
        });
        
        // Get episode section HTML
        console.log('\n\n=== EPISODE SECTION HTML ===\n');
        
        const $episodeSection = $('.anime__details__episodes');
        if ($episodeSection.length > 0) {
            console.log('Found .anime__details__episodes\n');
            console.log('First 1500 chars:');
            console.log($episodeSection.html().substring(0, 1500));
            console.log('...\n');
            
            // Analyze episode links
            console.log('\n--- Episode Links ---');
            $episodeSection.find('a').slice(0, 5).each((i, link) => {
                const $link = $(link);
                console.log(`\n${i + 1}. ${$link.text().trim()}`);
                console.log(`   href: ${$link.attr('href')}`);
                console.log(`   class: ${$link.attr('class')}`);
            });
        } else {
            console.log('⚠ .anime__details__episodes not found!\n');
            
            // Try alternative selectors
            const $altSection = $('[class*="episode"]').first();
            if ($altSection.length > 0) {
                console.log(`Found alternative: ${$altSection.attr('class')}\n`);
                console.log('HTML preview:');
                console.log($altSection.html().substring(0, 1000));
            }
        }
        
        // Look for all links to episodes
        console.log('\n\n=== ALL EPISODE LINKS ON PAGE ===\n');
        const episodeLinks = $('a[href*="/episode/"]');
        console.log(`Found ${episodeLinks.length} episode links`);
        
        episodeLinks.slice(0, 10).each((i, link) => {
            const $link = $(link);
            console.log(`${i + 1}. ${$link.text().trim()} - ${$link.attr('href')}`);
        });
        
        console.log('\n\n=== DONE ===');
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

debugEpisodeList();
