const { scrapeEpisode } = require('./server/kuramanime-scraper');

async function testIntegratedServers() {
    console.log('Testing integrated streaming servers...\n');
    
    try {
        const animeId = '4081';
        const slug = 'ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga';
        const episodeNum = '1';
        
        console.log('Fetching episode data...');
        const result = await scrapeEpisode(animeId, slug, episodeNum);
        
        console.log('\n🎬 Streaming Servers with Integrated Sources:');
        console.log('==============================================');
        
        result.streaming_servers.forEach((server, index) => {
            const icon = server.selected ? '✓' : ' ';
            console.log(`\n[${icon}] ${index + 1}. ${server.name}`);
            console.log(`    Value: ${server.value}`);
            console.log(`    Selected: ${server.selected ? 'Yes' : 'No'}`);
            
            if (server.sources && server.sources.length > 0) {
                console.log(`    Sources: ${server.sources.length}`);
                server.sources.forEach(source => {
                    if (source.quality === 'iframe') {
                        console.log(`      - iframe: ${source.url.substring(0, 50)}...`);
                    } else {
                        console.log(`      - ${source.quality}: ${source.url.substring(0, 50)}...`);
                    }
                });
            } else {
                console.log(`    Sources: Not available (will be loaded on demand)`);
            }
        });
        
        console.log('\n📊 Summary:');
        console.log('===========');
        console.log('Current Server:', result.current_server);
        console.log('Total Streaming Servers:', result.streaming_servers.length);
        
        const serversWithSources = result.streaming_servers.filter(s => s.sources && s.sources.length > 0).length;
        console.log('Servers with Sources:', serversWithSources);
        
        console.log('Episode List:', result.episode_list.length, 'episodes');
        console.log('Download Links:', result.download_links.length, 'links');
        
        // Check if old video_sources field exists
        if (result.video_sources) {
            console.log('\n⚠️ Warning: Old video_sources field still exists!');
        } else {
            console.log('\n✅ Structure is clean (no separate video_sources field)');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

testIntegratedServers();
