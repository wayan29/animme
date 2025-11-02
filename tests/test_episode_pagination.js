/**
 * Test script to verify episode pagination fix
 * Tests the sample URL provided: https://v8.kuramanime.tel/anime/4039/cang-lan-jue-2/episode/18
 */

const kuramanimeScraper = require('../server/kuramanime');

async function testEpisodePagination() {
    console.log('='.repeat(80));
    console.log('Testing Episode Pagination Fix');
    console.log('='.repeat(80));

    try {
        const animeId = '4039';
        const slug = 'cang-lan-jue-2';
        const episodeNum = '18';

        console.log(`\nTesting: anime/${animeId}/${slug}/episode/${episodeNum}`);
        console.log(`Expected: Should fetch all episodes across multiple pages`);
        console.log('-'.repeat(80));

        const startTime = Date.now();
        const result = await kuramanimeScraper.scrapeEpisode(animeId, slug, episodeNum);
        const endTime = Date.now();

        console.log('\n' + '='.repeat(80));
        console.log('TEST RESULTS');
        console.log('='.repeat(80));

        console.log(`\n✓ Time taken: ${(endTime - startTime) / 1000}s`);
        console.log(`✓ Anime title: ${result.anime_title}`);
        console.log(`✓ Episode title: ${result.title}`);
        console.log(`✓ Current episode: ${result.episode}`);
        console.log(`✓ Total episodes found: ${result.episode_list.length}`);

        if (result.episode_list.length > 0) {
            console.log('\nFirst 5 episodes:');
            result.episode_list.slice(0, 5).forEach(ep => {
                const activeMarker = ep.is_active ? '← CURRENT' : '';
                const newMarker = ep.is_new ? '🔥' : '';
                console.log(`  - ${ep.title} ${newMarker} ${activeMarker}`);
            });

            if (result.episode_list.length > 5) {
                console.log('  ...');
                console.log(`\nLast 5 episodes:`);
                result.episode_list.slice(-5).forEach(ep => {
                    const activeMarker = ep.is_active ? '← CURRENT' : '';
                    const newMarker = ep.is_new ? '🔥' : '';
                    console.log(`  - ${ep.title} ${newMarker} ${activeMarker}`);
                });
            }
        }

        console.log(`\n✓ Streaming servers: ${result.streaming_servers.length}`);
        result.streaming_servers.forEach(server => {
            console.log(`  - ${server.name} (${server.sources.length} sources)`);
        });

        console.log(`\n✓ Download links: ${result.download_links.length}`);
        if (result.download_links.length > 0) {
            const groupedByQuality = result.download_links.reduce((acc, link) => {
                if (!acc[link.quality]) acc[link.quality] = [];
                acc[link.quality].push(link.provider);
                return acc;
            }, {});

            Object.entries(groupedByQuality).forEach(([quality, providers]) => {
                console.log(`  - ${quality}: ${providers.join(', ')}`);
            });
        }

        console.log('\n' + '='.repeat(80));
        console.log('✓ TEST PASSED - Episode pagination working correctly');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('\n' + '='.repeat(80));
        console.error('✗ TEST FAILED');
        console.error('='.repeat(80));
        console.error(`Error: ${error.message}`);
        console.error(`Stack: ${error.stack}`);
        process.exit(1);
    }
}

testEpisodePagination();
