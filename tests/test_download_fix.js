const { scrapeEpisode } = require('../server/kuramanime');

async function testDownloadLinks() {
    console.log('Testing episode scraping with download links...\n');
    
    try {
        // Test URL: https://v8.kuramanime.tel/anime/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga/episode/1
        const animeId = '4081';
        const slug = 'ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga';
        const episodeNum = '1';
        
        const result = await scrapeEpisode(animeId, slug, episodeNum);
        
        console.log('Episode Information:');
        console.log('===================');
        console.log('Title:', result.title);
        console.log('Anime Title:', result.anime_title);
        console.log('Episode:', result.episode);
        console.log('Current Server:', result.current_server);
        console.log('\nStreaming Servers:');
        result.streaming_servers.forEach(server => {
            console.log(`  - ${server.name} (${server.value})${server.selected ? ' [SELECTED]' : ''}`);
        });
        
        console.log('\nDownload Links:');
        console.log('===============');
        if (result.download_links.length === 0) {
            console.log('  ❌ NO DOWNLOAD LINKS FOUND!');
        } else {
            console.log(`  ✓ Found ${result.download_links.length} download links\n`);
            
            // Group by quality
            const grouped = {};
            result.download_links.forEach(link => {
                if (!grouped[link.quality]) {
                    grouped[link.quality] = [];
                }
                grouped[link.quality].push(link);
            });
            
            // Display grouped
            for (const [quality, links] of Object.entries(grouped)) {
                console.log(`  ${quality} — ${links[0].size}`);
                links.forEach(link => {
                    console.log(`    - ${link.provider}: ${link.url}`);
                });
                console.log('');
            }
        }
        
        console.log('Navigation:');
        console.log('===========');
        console.log('Previous Episode:', result.navigation.prev_episode || 'None');
        console.log('Next Episode:', result.navigation.next_episode || 'None');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

testDownloadLinks();
