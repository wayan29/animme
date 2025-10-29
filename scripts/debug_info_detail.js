const axios = require('axios');
const cheerio = require('cheerio');

async function debugInfoDetail() {
    const url = 'https://v8.kuramanime.tel/anime/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga';
    const { data } = await axios.get(url, {
        headers: {'User-Agent': 'Mozilla/5.0'}
    });
    
    const $ = cheerio.load(data);
    
    console.log('=== First 3 items HTML structure ===\n');
    
    $('.anime__details__widget ul li').slice(0, 3).each((i, el) => {
        const $el = $(el);
        console.log(`\nItem ${i+1} HTML:`);
        console.log($el.html());
        console.log('---');
        
        const label = $el.find('span').first().text().trim();
        const allText = $el.text().trim();
        const cloned = $el.clone();
        cloned.children().remove();
        const valueMethod1 = cloned.text().trim();
        
        // Try different methods
        const $span = $el.find('span').first();
        $span.remove();
        const valueMethod2 = $el.text().trim();
        
        console.log(`Label: "${label}"`);
        console.log(`All text: "${allText}"`);
        console.log(`Method 1 (clone): "${valueMethod1}"`);
        console.log(`Method 2 (remove span): "${valueMethod2}"`);
        
        // Check if value is in <a> tag
        const valueInLink = $el.find('a').text().trim();
        console.log(`Value in <a>: "${valueInLink}"`);
    });
}

debugInfoDetail().catch(console.error);
