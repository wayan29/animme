const axios = require('axios');

async function testPagination() {
    console.log('🎬 Testing Kuramanime Ongoing Pagination\n');
    console.log('='.repeat(70));
    
    const baseUrl = 'http://localhost:5000/api/v3/kuramanime/ongoing';
    let totalAnimeCount = 0;
    
    try {
        // Test page 1 to get total pages
        const firstResponse = await axios.get(`${baseUrl}?page=1`);
        const totalPages = firstResponse.data.data.pagination.total_pages || 11;
        
        console.log(`\n📊 Total Pages: ${totalPages}\n`);
        
        // Load all pages
        for (let page = 1; page <= Math.min(totalPages, 5); page++) { // Limit to 5 pages for quick test
            console.log(`\n📄 Loading Page ${page}...`);
            console.log('-'.repeat(70));
            
            const response = await axios.get(`${baseUrl}?page=${page}`);
            const data = response.data.data;
            
            console.log(`   ✓ Current page: ${data.pagination.current_page}`);
            console.log(`   ✓ Anime count: ${data.total_anime}`);
            console.log(`   ✓ Has next: ${data.pagination.has_next}`);
            console.log(`   ✓ Has prev: ${data.pagination.has_prev}`);
            
            totalAnimeCount += data.total_anime;
            
            // Show first 2 anime from this page
            console.log(`\n   📺 First 2 anime from page ${page}:`);
            data.anime_list.slice(0, 2).forEach((anime, index) => {
                console.log(`      ${index + 1}. ${anime.title}`);
                console.log(`         Episode: ${anime.episode_text} ${anime.is_trending ? '🔥' : ''}`);
            });
        }
        
        console.log('\n' + '='.repeat(70));
        console.log(`\n✅ Test PASSED!`);
        console.log(`📊 Total anime found (first 5 pages): ${totalAnimeCount}`);
        console.log(`📄 Total pages available: ${totalPages}`);
        console.log('\n💡 To load all pages, change Math.min(totalPages, 5) to totalPages');
        
    } catch (error) {
        console.error('\n❌ Test FAILED!');
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

testPagination();
