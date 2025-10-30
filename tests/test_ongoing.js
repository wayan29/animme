const kuramanimeScraper = require('../server/kuramanime');

async function testOngoing() {
    console.log('🎬 Testing Kuramanime Ongoing Anime Scraper\n');
    console.log('='.repeat(60));
    
    try {
        const data = await kuramanimeScraper.scrapeOngoing(1, 'updated');
        
        console.log('\n📊 Summary:');
        console.log(`   Total anime found: ${data.total_anime}`);
        console.log(`   Current page: ${data.pagination.current_page}`);
        console.log(`   Has next page: ${data.pagination.has_next}`);
        console.log(`   Has previous page: ${data.pagination.has_prev}`);
        console.log(`   Total pages: ${data.pagination.total_pages || 'Unknown'}`);
        
        console.log('\n\n📺 Ongoing Anime List (First 5):');
        console.log('='.repeat(60));
        
        data.anime_list.slice(0, 5).forEach((anime, index) => {
            console.log(`\n${index + 1}. ${anime.title}`);
            console.log(`   ID: ${anime.anime_id}`);
            console.log(`   Slug: ${anime.slug}`);
            console.log(`   Episode: ${anime.episode_text}`);
            console.log(`   Current: ${anime.current_episode} / ${anime.total_episodes}`);
            console.log(`   Trending: ${anime.is_trending ? '🔥 Yes' : 'No'}`);
            console.log(`   Tags: ${anime.tags.map(t => t.label).join(', ')}`);
            console.log(`   Latest Episode URL: ${anime.latest_episode_url}`);
            console.log(`   Anime URL: ${anime.anime_url}`);
            console.log(`   Poster: ${anime.poster.substring(0, 50)}...`);
        });
        
        console.log('\n\n✅ Test PASSED!');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('\n❌ Test FAILED!');
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

testOngoing();
