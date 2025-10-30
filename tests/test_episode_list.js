const { scrapeEpisode } = require('../server/kuramanime');

async function testEpisodeList() {
    console.log('Testing episode list and navigation extraction...\n');
    
    try {
        const animeId = '4081';
        const slug = 'ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga';
        const episodeNum = '1';
        
        const result = await scrapeEpisode(animeId, slug, episodeNum);
        
        console.log('Episode Information:');
        console.log('===================');
        console.log('Title:', result.title);
        console.log('Anime Title:', result.anime_title);
        console.log('Current Episode:', result.episode);
        console.log('');
        
        console.log('Anime Detail URL:');
        console.log('=================');
        console.log(result.anime_detail_url || '❌ Not found');
        console.log('');
        
        console.log('Episode List:');
        console.log('=============');
        if (result.episode_list.length === 0) {
            console.log('❌ No episodes found!');
        } else {
            console.log(`✓ Found ${result.episode_list.length} episodes\n`);
            
            result.episode_list.forEach(ep => {
                const activeTag = ep.is_active ? ' [CURRENT]' : '';
                const newTag = ep.is_new ? ' 🔥' : '';
                console.log(`  ${ep.title}${activeTag}${newTag}`);
                console.log(`    Episode: ${ep.episode}`);
                console.log(`    URL: ${ep.url}`);
                console.log('');
            });
        }
        
        console.log('Navigation:');
        console.log('===========');
        console.log('Previous Episode:', result.navigation.prev_episode || 'None');
        console.log('Next Episode:', result.navigation.next_episode || 'None');
        console.log('');
        
        console.log('Download Links:', result.download_links.length, 'links found');
        console.log('Streaming Servers:', result.streaming_servers.length, 'servers found');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

testEpisodeList();
