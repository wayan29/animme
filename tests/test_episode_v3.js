const kuramanimeScraper = require('./server/kuramanime-scraper');

async function testEpisode() {
    console.log('Testing Kuramanime V3 Episode Scraper');
    console.log('=======================================\n');
    
    // Sample URL: https://v8.kuramanime.tel/anime/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga/episode/1
    const animeId = '4081';
    const slug = 'ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga';
    const episodeNum = '1';
    
    console.log(`Testing episode: ${animeId}/${slug}/episode/${episodeNum}\n`);
    
    try {
        const result = await kuramanimeScraper.scrapeEpisode(animeId, slug, episodeNum);
        
        console.log('=== EPISODE INFO ===');
        console.log('Anime Title:', result.anime_title);
        console.log('Episode Title:', result.title);
        console.log('Episode Number:', result.episode);
        console.log('Current Server:', result.current_server);
        console.log();
        
        console.log('=== STREAMING SERVERS ===');
        result.streaming_servers.forEach((server, i) => {
            console.log(`${i + 1}. ${server.name}`);
            console.log(`   Value: ${server.value}`);
            console.log(`   Selected: ${server.selected ? 'Yes' : 'No'}`);
        });
        console.log();
        
        console.log('=== DOWNLOAD LINKS ===');
        if (result.download_links.length > 0) {
            result.download_links.forEach((link, i) => {
                console.log(`${i + 1}. ${link.text}`);
                console.log(`   Quality: ${link.quality}`);
                console.log(`   Size: ${link.size}`);
                console.log(`   URL: ${link.url}`);
            });
        } else {
            console.log('No download links found');
        }
        console.log();
        
        console.log('=== NAVIGATION ===');
        console.log('Previous Episode:', result.navigation.prev_episode || 'N/A');
        console.log('Next Episode:', result.navigation.next_episode || 'N/A');
        console.log();
        
        console.log('=== FULL RESULT ===');
        console.log(JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.error('Error testing episode scraper:', error.message);
        console.error(error);
    }
}

testEpisode();
