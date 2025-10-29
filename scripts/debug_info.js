const axios = require('axios');
const cheerio = require('cheerio');

async function debugInfo() {
    const url = 'https://v8.kuramanime.tel/anime/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga';
    const { data } = await axios.get(url, {
        headers: {'User-Agent': 'Mozilla/5.0'}
    });
    
    const $ = cheerio.load(data);
    
    console.log('Testing .anime__details__widget ul li:');
    console.log('Count:', $('.anime__details__widget ul li').length);
    
    $('.anime__details__widget ul li').slice(0, 5).each((i, el) => {
        const $el = $(el);
        const label = $el.find('span').first().text().trim().replace(':', '');
        const value = $el.clone().children().remove().end().text().trim();
        console.log(`${i+1}. Label: "${label}" | Value: "${value}"`);
    });
}

debugInfo().catch(console.error);
