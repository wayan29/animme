const kuramanimeScraper = require('../server/kuramanime');

async function test() {
    try {
        console.log('🧪 Testing Kuramanime Scraper...\n');
        
        // Test 1: Home
        console.log('1️⃣ Testing scrapeHome()...');
        const home = await kuramanimeScraper.scrapeHome();
        console.log(`✅ Banner Rekomendasi: ${home.banner_rekomendasi.length} items`);
        console.log(`   First: ${home.banner_rekomendasi[0]?.title || 'None'}`);
        console.log(`✅ Sedang Tayang: ${home.sedang_tayang.length} items`);
        console.log(`   First: ${home.sedang_tayang[0]?.title || 'None'}`);
        console.log(`✅ Selesai Tayang: ${home.selesai_tayang.length} items`);
        console.log(`   First: ${home.selesai_tayang[0]?.title || 'None'}`);
        console.log(`✅ Film: ${home.film_layar_lebar.length} items`);
        console.log(`✅ Most Viewed: ${home.dilihat_terbanyak_musim_ini.length} items`);
        console.log(`✅ Komentar Episode: ${home.komentar_terbaru_episode.length} items`);
        console.log(`✅ Komentar Anime: ${home.komentar_terbaru_anime.length} items\n`);
        
        // Test 2: Search
        console.log('2️⃣ Testing scrapeSearch("naruto")...');
        const search = await kuramanimeScraper.scrapeSearch('naruto', 1);
        console.log(`✅ Found: ${search.results.length} results`);
        if (search.results.length > 0) {
            console.log(`   First: ${search.results[0].title}`);
            console.log(`   Slug: ${search.results[0].slug}`);
            console.log(`   ID: ${search.results[0].anime_id}\n`);
            
            // Test 3: Detail
            if (search.results[0].anime_id && search.results[0].slug) {
                console.log(`3️⃣ Testing scrapeDetail(${search.results[0].anime_id}, ${search.results[0].slug})...`);
                const detail = await kuramanimeScraper.scrapeDetail(search.results[0].anime_id, search.results[0].slug);
                console.log(`✅ Title: ${detail.title}`);
                console.log(`✅ Genres: ${detail.genres.join(', ')}`);
                console.log(`✅ Episodes: ${detail.episodes.length} episodes`);
            }
        } else {
            console.log('⚠️ No search results, skipping detail test');
        }
        
        console.log('\n✅ All tests completed!');
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

test();
