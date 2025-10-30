const { scrapeDetail } = require('../server/kuramanime');

async function testScrapeDetail() {
    try {
        console.log('Testing scrapeDetail with anime_lainnya...\n');
        console.log('URL: https://v8.kuramanime.tel/anime/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga\n');
        
        const result = await scrapeDetail('4081', 'ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga');
        
        console.log('=== ANIME DETAIL ===\n');
        console.log(`Title: ${result.title}`);
        console.log(`Poster: ${result.poster ? '✓ Found' : '✗ Missing'}`);
        console.log(`Synopsis: ${result.synopsis.substring(0, 100)}...`);
        console.log(`Genres: ${result.genres.join(', ')}`);
        console.log(`Episodes: ${result.episodes.length} episodes`);
        
        console.log('\n--- Info ---');
        Object.keys(result.info).forEach(key => {
            console.log(`  ${key}: ${result.info[key]}`);
        });
        
        console.log('\n\n=== ANIME LAINNYA (RECOMMENDATIONS) ===\n');
        console.log(`Found ${result.anime_lainnya.length} recommended anime\n`);
        
        result.anime_lainnya.forEach((anime, i) => {
            console.log(`${i + 1}. ${anime.title}`);
            console.log(`   Anime ID: ${anime.anime_id}`);
            console.log(`   Slug: ${anime.slug}`);
            console.log(`   Poster: ${anime.poster ? '✓ Found' : '✗ Missing'} - ${anime.poster}`);
            console.log(`   Rating: ${anime.rating}`);
            console.log(`   Quality: ${anime.quality}`);
            console.log(`   URL: ${anime.url}`);
            console.log('');
        });
        
        // Check if all recommendations have posters
        const withPoster = result.anime_lainnya.filter(a => a.poster);
        const withoutPoster = result.anime_lainnya.filter(a => !a.poster);
        
        console.log('=== SUMMARY ===');
        console.log(`✓ Recommendations with poster: ${withPoster.length}`);
        console.log(`✗ Recommendations without poster: ${withoutPoster.length}`);
        
        if (withoutPoster.length > 0) {
            console.log('\n⚠ WARNING: Some recommendations are missing posters!');
        } else if (result.anime_lainnya.length > 0) {
            console.log('\n✓ SUCCESS: All recommendations have posters!');
        }
        
        // Test with another anime
        console.log('\n\n=== TESTING WITH ANOTHER ANIME ===\n');
        console.log('URL: https://v8.kuramanime.tel/anime/4095/shinjiteita-nakama-tachi-ni-dungeon-okuchi-de-korosarekaketa-ga-gift-mugen-gacha-de-level-9999-no-nakama-tachi-wo-te-ni-irete-moto-party-member-to-sekai-ni-fukushuu-zamaa-shimasu\n');
        
        const result2 = await scrapeDetail('4095', 'shinjiteita-nakama-tachi-ni-dungeon-okuchi-de-korosarekaketa-ga-gift-mugen-gacha-de-level-9999-no-nakama-tachi-wo-te-ni-irete-moto-party-member-to-sekai-ni-fukushuu-zamaa-shimasu');
        
        console.log(`Title: ${result2.title}`);
        console.log(`Recommendations: ${result2.anime_lainnya.length} items`);
        
        if (result2.anime_lainnya.length > 0) {
            console.log('\nFirst recommendation:');
            console.log(`  - ${result2.anime_lainnya[0].title}`);
            console.log(`  - Poster: ${result2.anime_lainnya[0].poster ? '✓' : '✗'}`);
            console.log(`  - Rating: ${result2.anime_lainnya[0].rating}`);
        }
        
        console.log('\n✓ All tests completed!');
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

testScrapeDetail();
