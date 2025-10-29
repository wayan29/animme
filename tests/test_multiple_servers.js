const { scrapeEpisode } = require('./server/kuramanime-scraper');

async function testMultipleServers() {
    console.log('Testing multiple server extraction...\n');
    
    try {
        const animeId = '4081';
        const slug = 'ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga';
        const episodeNum = '1';
        
        console.log('Fetching episode data with all servers...');
        const result = await scrapeEpisode(animeId, slug, episodeNum);
        
        console.log('\n🎬 Video Sources from All Servers:');
        console.log('==================================');
        
        if (result.video_sources && result.video_sources.servers) {
            const servers = result.video_sources.servers;
            const serverNames = Object.keys(servers);
            
            console.log(`✅ Extracted from ${serverNames.length} servers\n`);
            
            serverNames.forEach(serverName => {
                const sources = servers[serverName];
                console.log(`📺 ${serverName.toUpperCase()}`);
                console.log('─'.repeat(40));
                
                if (sources.length === 0) {
                    console.log('  ❌ No sources available');
                } else {
                    sources.forEach(source => {
                        if (source.quality === 'iframe') {
                            console.log(`  - iframe: ${source.url.substring(0, 60)}...`);
                        } else {
                            console.log(`  - ${source.quality}: ${source.url.substring(0, 60)}...`);
                        }
                    });
                }
                console.log('');
            });
            
            console.log('Default Server:', result.video_sources.default_server);
            
        } else {
            console.log('❌ Video sources not found');
        }
        
        console.log('\n📊 Summary:');
        console.log('===========');
        console.log('Episode List:', result.episode_list.length, 'episodes');
        console.log('Download Links:', result.download_links.length, 'links');
        console.log('Streaming Servers:', result.streaming_servers.length, 'servers');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

testMultipleServers();
