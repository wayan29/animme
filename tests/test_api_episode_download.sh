#!/bin/bash

echo "========================================="
echo "Testing Kuramanime V3 Episode API"
echo "========================================="
echo ""
echo "Starting server in background..."

# Start server in background
node server/server.js &
SERVER_PID=$!

# Wait for server to start
echo "Waiting for server to start..."
sleep 3

echo ""
echo "Testing episode endpoint with download links:"
echo "URL: http://localhost:5000/api/v3/kuramanime/episode/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga/1"
echo ""

# Test the API
curl -s "http://localhost:5000/api/v3/kuramanime/episode/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga/1" | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
if (data.status === 'success') {
    console.log('✅ API Response: SUCCESS');
    console.log('');
    console.log('Title:', data.data.title);
    console.log('Anime Title:', data.data.anime_title);
    console.log('Episode:', data.data.episode);
    console.log('Current Server:', data.data.current_server);
    console.log('');
    console.log('Streaming Servers:', data.data.streaming_servers.length);
    console.log('Download Links:', data.data.download_links.length);
    console.log('');
    
    if (data.data.download_links.length > 0) {
        console.log('✅ Download Links Found:');
        console.log('');
        
        // Group by quality
        const grouped = {};
        data.data.download_links.forEach(link => {
            if (!grouped[link.quality]) {
                grouped[link.quality] = [];
            }
            grouped[link.quality].push(link);
        });
        
        for (const [quality, links] of Object.entries(grouped)) {
            console.log(\`  \${quality} — \${links[0].size}\`);
            links.slice(0, 3).forEach(link => {
                console.log(\`    - \${link.provider}: \${link.url.substring(0, 50)}...\`);
            });
            console.log('');
        }
    } else {
        console.log('❌ No download links found!');
    }
    
    console.log('Navigation:');
    console.log('  Previous:', data.data.navigation.prev_episode || 'None');
    console.log('  Next:', data.data.navigation.next_episode || 'None');
} else {
    console.log('❌ API Response: ERROR');
    console.log('Message:', data.message);
}
"

echo ""
echo "========================================="
echo "Stopping server..."
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo "✅ Test complete"
echo "========================================="
