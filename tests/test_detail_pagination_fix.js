/**
 * Test the scrapeDetail pagination fix
 */

const kuramanimeScraper = require('../server/kuramanime');

async function testDetailPaginationFix() {
    console.log('='.repeat(80));
    console.log('Testing scrapeDetail Pagination Fix');
    console.log('='.repeat(80));

    try {
        const animeId = '4039';
        const slug = 'cang-lan-jue-2';

        console.log(`\nTesting: anime/${animeId}/${slug}`);
        console.log(`Expected: Should fetch all 18 episodes across all pages`);
        console.log('-'.repeat(80));

        const startTime = Date.now();
        const result = await kuramanimeScraper.scrapeDetail(animeId, slug);
        const endTime = Date.now();

        console.log('\n' + '='.repeat(80));
        console.log('TEST RESULTS');
        console.log('='.repeat(80));

        console.log(`\n✓ Time taken: ${(endTime - startTime) / 1000}s`);
        console.log(`✓ Anime title: ${result.title}`);
        console.log(`✓ Total episodes found: ${result.episodes.length}`);

        if (result.episodes.length > 0) {
            console.log('\nFirst 5 episodes:');
            result.episodes.slice(0, 5).forEach(ep => {
                console.log(`  - ${ep.title}`);
            });

            if (result.episodes.length > 5) {
                console.log('  ...');
                console.log(`\nLast 5 episodes:`);
                result.episodes.slice(-5).forEach(ep => {
                    console.log(`  - ${ep.title}`);
                });
            }

            // Check for specific episodes that were missing before
            const missingEpisodes = [14, 15, 16, 17];
            console.log('\nChecking for previously missing episodes:');
            missingEpisodes.forEach(epNum => {
                const found = result.episodes.find(ep => ep.url.includes(`/episode/${epNum}`));
                if (found) {
                    console.log(`  ✓ Episode ${epNum}: FOUND - ${found.title}`);
                } else {
                    console.log(`  ✗ Episode ${epNum}: MISSING`);
                }
            });
        }

        console.log(`\n✓ Genres: ${result.genres.join(', ')}`);
        console.log(`✓ Batch downloads: ${result.batch_list.length}`);
        console.log(`✓ Related anime: ${result.anime_lainnya.length}`);

        console.log('\n' + '='.repeat(80));

        // Validate fix
        if (result.episodes.length >= 18) {
            console.log('✓ TEST PASSED - All episodes retrieved successfully!');
            console.log('='.repeat(80));
        } else {
            console.log('✗ TEST FAILED - Not all episodes retrieved');
            console.log(`  Expected: >= 18 episodes`);
            console.log(`  Got: ${result.episodes.length} episodes`);
            console.log('='.repeat(80));
            process.exit(1);
        }

    } catch (error) {
        console.error('\n' + '='.repeat(80));
        console.error('✗ TEST FAILED');
        console.error('='.repeat(80));
        console.error(`Error: ${error.message}`);
        console.error(`Stack: ${error.stack}`);
        process.exit(1);
    }
}

testDetailPaginationFix();
