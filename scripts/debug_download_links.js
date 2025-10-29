const axios = require('axios');
const cheerio = require('cheerio');

async function debugDownloadLinks() {
    const url = 'https://v8.kuramanime.tel/anime/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga/episode/1';
    
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        
        console.log('=== Searching for Download Section ===\n');
        
        // Check downloadLinkSection
        const downloadSection = $('#downloadLinkSection');
        console.log('Download section exists:', downloadSection.length > 0);
        console.log('Download section HTML:');
        console.log(downloadSection.html()?.substring(0, 500));
        console.log('\n');
        
        // Check all links in the page
        console.log('=== All Links with Download/Unduh/Quality Keywords ===\n');
        $('a').each((i, el) => {
            const $el = $(el);
            const href = $el.attr('href');
            const text = $el.text().trim();
            
            if (text && (
                text.includes('480') || text.includes('720') || text.includes('1080') ||
                text.includes('360') || text.toLowerCase().includes('download') ||
                text.toLowerCase().includes('unduh') || text.toLowerCase().includes('mkv') ||
                text.toLowerCase().includes('mp4')
            )) {
                console.log(`Text: ${text}`);
                console.log(`Href: ${href}`);
                console.log(`Parent: ${$el.parent().attr('class') || 'no class'}`);
                console.log('---');
            }
        });
        
        // Check for data attributes that might contain episode/download info
        console.log('\n=== Elements with data-* attributes ===\n');
        $('[data-episode], [data-download], [data-link], [data-url], [data-src]').each((i, el) => {
            const $el = $(el);
            console.log('Tag:', el.name);
            console.log('Attributes:', el.attribs);
            console.log('Text:', $el.text().trim().substring(0, 100));
            console.log('---');
        });
        
        // Look for inline scripts that might load download links
        console.log('\n=== Inline Scripts (first 3) ===\n');
        let scriptCount = 0;
        $('script').each((i, el) => {
            const $el = $(el);
            const scriptContent = $el.html();
            
            if (scriptContent && (
                scriptContent.includes('download') || 
                scriptContent.includes('animeDownloadLink') ||
                scriptContent.includes('episode')
            )) {
                scriptCount++;
                if (scriptCount <= 3) {
                    console.log(`Script ${scriptCount}:`);
                    console.log(scriptContent.substring(0, 500));
                    console.log('\n---\n');
                }
            }
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugDownloadLinks();
