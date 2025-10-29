const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://v8.kuramanime.tel';

async function debugEpisodePopover() {
    try {
        const url = `${BASE_URL}/anime/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga`;
        console.log(`Fetching: ${url}\n`);
        
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        
        console.log('=== ANALYZING "DAFTAR EPISODE" BUTTON ===\n');
        
        // Find the Daftar Episode button
        const $episodeBtn = $('#episodeLists, a.follow-btn:contains("Daftar Episode")');
        
        if ($episodeBtn.length > 0) {
            console.log('Found "Daftar Episode" button!\n');
            console.log('Button attributes:');
            console.log(`  ID: ${$episodeBtn.attr('id')}`);
            console.log(`  Class: ${$episodeBtn.attr('class')}`);
            console.log(`  data-toggle: ${$episodeBtn.attr('data-toggle')}`);
            console.log(`  data-content: ${$episodeBtn.attr('data-content')}`);
            console.log(`  data-html: ${$episodeBtn.attr('data-html')}`);
            console.log(`  onclick: ${$episodeBtn.attr('onclick')}`);
            console.log(`  href: ${$episodeBtn.attr('href')}`);
            
            // Check for popover content
            const dataContent = $episodeBtn.attr('data-content');
            if (dataContent) {
                console.log('\n--- Popover Content (first 2000 chars) ---');
                console.log(dataContent.substring(0, 2000));
                console.log('...\n');
                
                // Parse the popover content as HTML
                const $popover = cheerio.load(dataContent);
                console.log('\n--- Parsing Episode Links from Popover ---');
                const episodeLinks = $popover('a[href*="/episode/"]');
                console.log(`Found ${episodeLinks.length} episode links in popover\n`);
                
                episodeLinks.slice(0, 10).each((i, link) => {
                    const $link = $popover(link);
                    console.log(`${i + 1}. ${$link.text().trim()} - ${$link.attr('href')}`);
                });
            }
        } else {
            console.log('⚠ "Daftar Episode" button not found!\n');
        }
        
        // Also check if there's an episode container on the page
        console.log('\n\n=== CHECKING FOR EPISODE CONTAINERS ===\n');
        
        const episodeContainers = [
            '#episodeList',
            '.episode-list',
            '[id*="episode"]',
            '[class*="episode-list"]'
        ];
        
        episodeContainers.forEach(selector => {
            const $container = $(selector);
            if ($container.length > 0) {
                console.log(`✓ Found: ${selector}`);
                console.log(`  HTML preview: ${$container.html().substring(0, 500)}...\n`);
            }
        });
        
        // Check all links containing "/episode/"
        console.log('\n=== ALL EPISODE LINKS ON PAGE ===\n');
        const allEpisodeLinks = $('a[href*="/episode/"]');
        console.log(`Total episode links found: ${allEpisodeLinks.length}\n`);
        
        if (allEpisodeLinks.length > 0) {
            allEpisodeLinks.slice(0, 10).each((i, link) => {
                const $link = $(link);
                console.log(`${i + 1}. ${$link.text().trim()} - ${$link.attr('href')}`);
            });
        }
        
        // Check for JavaScript that might load episodes
        console.log('\n\n=== CHECKING SCRIPTS FOR EPISODE LOADING ===\n');
        
        $('script').each((i, script) => {
            const scriptContent = $(script).html() || '';
            const src = $(script).attr('src');
            
            if (scriptContent.includes('episodeLists') || scriptContent.includes('episode')) {
                console.log(`\nScript ${i + 1}${src ? ` (src: ${src})` : ' (inline)'}:`);
                
                // Extract relevant lines
                const lines = scriptContent.split('\n');
                const relevantLines = lines.filter(line => 
                    line.includes('episodeLists') || 
                    line.includes('data-content') ||
                    line.includes('popover')
                ).slice(0, 10);
                
                if (relevantLines.length > 0) {
                    relevantLines.forEach(line => console.log(`  ${line.trim()}`));
                }
            }
        });
        
        console.log('\n\n=== DONE ===');
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

debugEpisodePopover();
