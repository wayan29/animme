const axios = require('axios');
const cheerio = require('cheerio');

async function analyzeMetadata() {
    const { data } = await axios.get('https://v8.kuramanime.tel', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    const $ = cheerio.load(data);
    
    console.log('🔍 Analyzing Metadata Structure\n');
    
    // 1. Check Banner (hero slider)
    console.log('1️⃣ BANNER (.hero__items):');
    const $banner = $('#sliderSection .hero__items').first();
    console.log('   Labels:', $banner.find('.label').map((i, el) => $(el).text().trim()).get());
    console.log('');
    
    // 2. Check Sedang Tayang (product__item)
    console.log('2️⃣ SEDANG TAYANG (.product__item):');
    const $firstItem = $('.trending__product').first().find('.product__item').first();
    console.log('   HTML structure:');
    console.log('   .ep:', $firstItem.find('.ep').text().trim());
    console.log('   .view:', $firstItem.find('.view').text().trim());
    console.log('   .comment:', $firstItem.find('.comment').text().trim());
    console.log('   .label:', $firstItem.find('.label').map((i, el) => $(el).text().trim()).get());
    console.log('   ul li:', $firstItem.find('.product__item__text ul li').map((i, el) => $(el).text().trim()).get());
    console.log('');
    
    // 3. Check Most Viewed
    console.log('3️⃣ MOST VIEWED (.product__sidebar__view__item):');
    const $mostViewed = $('.product__sidebar__view').first().find('.product__sidebar__view__item').first();
    console.log('   .ep:', $mostViewed.find('.ep').text().trim());
    console.log('   .view:', $mostViewed.find('.view').text().trim());
    console.log('   .comment:', $mostViewed.find('.comment').text().trim());
    console.log('');
    
    // 4. Full HTML of first product__item
    console.log('4️⃣ FULL HTML SAMPLE:');
    console.log($firstItem.html());
}

analyzeMetadata().catch(console.error);
