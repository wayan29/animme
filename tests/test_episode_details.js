const { scrapeDetail } = require('../server/kuramanime');

async function testEpisodeList() {
    try {
        console.log('Testing Episode List from scrapeDetail...\n');
        
        const result = await scrapeDetail('4081', 'ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga');
        
        console.log(`Title: ${result.title}`);
        console.log(`\n=== EPISODE LIST (${result.episodes.length} episodes) ===\n`);
        
        result.episodes.forEach((episode, i) => {
            console.log(`${i + 1}. ${episode.title}`);
            console.log(`   URL: ${episode.url}`);
        });
        
        if (result.episodes.length > 0) {
            console.log('\n✓ SUCCESS: Episodes found and scraped from "Daftar Episode" popover!');
        } else {
            console.log('\n⚠ WARNING: No episodes found!');
        }
        
        // Test with another anime that might have more episodes
        console.log('\n\n=== Testing with another anime (more episodes) ===\n');
        
        const result2 = await scrapeDetail('4092', 'mushoku-no-eiyuu-betsu-ni-skill-nanka-iranakatta-n-da-ga');
        console.log(`Title: ${result2.title}`);
        console.log(`Episodes: ${result2.episodes.length}`);
        
        if (result2.episodes.length > 0) {
            console.log('\nFirst 5 episodes:');
            result2.episodes.slice(0, 5).forEach((ep, i) => {
                console.log(`  ${i + 1}. ${ep.title}`);
            });
        }
        
        console.log('\n✓ All tests completed!');
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

testEpisodeList();
