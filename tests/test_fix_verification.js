const { scrapeHome } = require('./server/kuramanime-scraper');

async function testFix() {
    try {
        console.log('Testing Kuramanime scrapeHome...\n');
        const result = await scrapeHome();
        
        console.log('=== DILIHAT TERBANYAK MUSIM INI ===\n');
        console.log(`Found ${result.dilihat_terbanyak_musim_ini.length} items\n`);
        
        result.dilihat_terbanyak_musim_ini.forEach((item, i) => {
            console.log(`${i + 1}. ${item.title}`);
            console.log(`   Poster: ${item.poster ? '✓ FOUND' : '✗ MISSING'} - ${item.poster}`);
            console.log(`   Rating: ${item.rating}`);
            console.log(`   Views: ${item.views || 'Loading...'}`);
            console.log(`   URL: ${item.url}`);
            console.log('');
        });
        
        // Check if all items have posters
        const itemsWithPoster = result.dilihat_terbanyak_musim_ini.filter(item => item.poster);
        const itemsWithoutPoster = result.dilihat_terbanyak_musim_ini.filter(item => !item.poster);
        
        console.log('=== SUMMARY ===');
        console.log(`✓ Items with poster: ${itemsWithPoster.length}`);
        console.log(`✗ Items without poster: ${itemsWithoutPoster.length}`);
        
        if (itemsWithoutPoster.length > 0) {
            console.log('\n⚠ WARNING: Some items are still missing posters!');
        } else {
            console.log('\n✓ SUCCESS: All items have posters!');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testFix();
