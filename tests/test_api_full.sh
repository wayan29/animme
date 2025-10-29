#!/bin/bash

echo "========================================="
echo "Testing Full V3 Episode API"
echo "========================================="
echo ""

# Test the API with running server
curl -s "http://localhost:5000/api/v3/kuramanime/episode/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga/1" | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
if (data.status === 'success') {
    console.log('✅ API Response: SUCCESS\n');
    
    const d = data.data;
    
    console.log('📺 Episode Information:');
    console.log('======================');
    console.log('Title:', d.title.substring(0, 80) + '...');
    console.log('Anime:', d.anime_title);
    console.log('Episode:', d.episode);
    console.log('Server:', d.current_server);
    console.log('');
    
    console.log('🔗 Navigation:');
    console.log('==============');
    console.log('Detail Anime:', d.anime_detail_url ? '✓ Available' : '❌ Missing');
    if (d.anime_detail_url) {
        console.log('  URL:', d.anime_detail_url.substring(0, 80) + '...');
    }
    console.log('');
    
    console.log('📋 Episode List:');
    console.log('================');
    console.log('Total Episodes:', d.episode_list.length);
    if (d.episode_list.length > 0) {
        console.log('Episodes:');
        d.episode_list.forEach(ep => {
            const activeTag = ep.is_active ? ' [CURRENT]' : '';
            const newTag = ep.is_new ? ' 🔥' : '';
            console.log(\`  - \${ep.title}\${activeTag}\${newTag}\`);
        });
    }
    console.log('');
    
    console.log('⬇️  Download Links:');
    console.log('==================');
    console.log('Total Links:', d.download_links.length);
    
    if (d.download_links.length > 0) {
        // Group by quality
        const grouped = {};
        d.download_links.forEach(link => {
            if (!grouped[link.quality]) {
                grouped[link.quality] = [];
            }
            grouped[link.quality].push(link);
        });
        
        console.log('Available Qualities:');
        for (const [quality, links] of Object.entries(grouped)) {
            console.log(\`  - \${quality} (\${links[0].size}) - \${links.length} providers\`);
        }
    }
    console.log('');
    
    console.log('🎬 Streaming Servers:');
    console.log('====================');
    console.log('Total Servers:', d.streaming_servers.length);
    d.streaming_servers.slice(0, 3).forEach(server => {
        const selectedTag = server.selected ? ' [SELECTED]' : '';
        console.log(\`  - \${server.name}\${selectedTag}\`);
    });
    if (d.streaming_servers.length > 3) {
        console.log(\`  ... and \${d.streaming_servers.length - 3} more\`);
    }
    console.log('');
    
    console.log('🎯 Episode Navigation:');
    console.log('=====================');
    console.log('Previous:', d.navigation.prev_episode ? '✓ Available' : '❌ None (first episode)');
    console.log('Next:', d.navigation.next_episode ? '✓ Available' : '❌ None (last episode)');
    
} else {
    console.log('❌ API Response: ERROR');
    console.log('Message:', data.message);
}
console.log('');
console.log('=========================================');
"

echo ""
