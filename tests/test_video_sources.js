const { scrapeEpisode } = require('../server/kuramanime');

async function testVideoSources() {
    console.log('Testing video source extraction...\n');
    
    try {
        const animeId = '4081';
        const slug = 'ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga';
        const episodeNum = '1';
        
        console.log('Fetching episode data...');
        const result = await scrapeEpisode(animeId, slug, episodeNum);
        
        console.log('\n📺 Video Sources:');
        console.log('================');
        
        if (result.video_sources) {
            console.log(`✅ Video sources extracted successfully!`);
            console.log('');
            
            console.log('Default Server:', result.video_sources.default_server);
            console.log('');
            
            console.log('Available Qualities:');
            result.video_sources.sources.forEach(source => {
                console.log(`  - ${source.quality}`);
                console.log(`    Type: ${source.type}`);
                console.log(`    URL: ${source.url.substring(0, 80)}...`);
                console.log('');
            });
            
            console.log('Auth Info:');
            console.log(`  data-kk: ${result.video_sources.auth_info.data_kk}`);
            console.log(`  page_token_key: ${result.video_sources.auth_info.page_token_key}`);
            console.log(`  server_key: ${result.video_sources.auth_info.server_key}`);
            
        } else {
            console.log('❌ Video sources not found or extraction failed');
        }
        
        console.log('\n📋 Other Data:');
        console.log('==============');
        console.log('Episode List:', result.episode_list.length, 'episodes');
        console.log('Download Links:', result.download_links.length, 'links');
        console.log('Streaming Servers:', result.streaming_servers.length, 'servers');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

testVideoSources();
