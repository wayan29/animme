const axios = require('axios');
const cheerio = require('cheerio');

async function debugPoster() {
    try {
        const url = 'https://v8.kuramanime.tel/anime/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga';
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        
        console.log('=== DEBUGGING POSTER LOCATION ===\n');
        
        $('.anime__details__sidebar').each((i, sidebar) => {
            const $sidebar = $(sidebar);
            const sectionTitle = $sidebar.find('.section-title h5, .section-title h4').text().trim();
            
            if (sectionTitle === 'Anime Lainnya') {
                console.log('Found "Anime Lainnya" section\n');
                
                $sidebar.find('#randomList a[href*="/anime/"]').each((j, el) => {
                    const $link = $(el);
                    console.log(`\n--- Item ${j + 1} ---`);
                    console.log('Full HTML:');
                    console.log($link.html());
                    console.log('\nLink attributes:');
                    console.log(`  href: ${$link.attr('href')}`);
                    console.log(`  data-setbg: ${$link.attr('data-setbg')}`);
                    console.log(`  class: ${$link.attr('class')}`);
                    
                    const $item = $link.find('.product__sidebar__view__item');
                    console.log('\nItem (.product__sidebar__view__item) attributes:');
                    console.log(`  class: ${$item.attr('class')}`);
                    console.log(`  data-setbg: ${$item.attr('data-setbg')}`);
                    
                    // Try to find data-setbg anywhere
                    const dataSetBg1 = $link.attr('data-setbg');
                    const dataSetBg2 = $item.attr('data-setbg');
                    const dataSetBg3 = $link.find('[data-setbg]').first().attr('data-setbg');
                    
                    console.log('\nTrying different selectors:');
                    console.log(`  $link.attr('data-setbg'): ${dataSetBg1}`);
                    console.log(`  $item.attr('data-setbg'): ${dataSetBg2}`);
                    console.log(`  $link.find('[data-setbg]').first(): ${dataSetBg3}`);
                });
            }
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugPoster();
