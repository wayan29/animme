const axios = require('axios');

async function testAZListAPI() {
    try {
        console.log('Testing V5 A-Z List API...\n');

        const response = await axios.get('http://localhost:5000/api/v5/anoboy/azlist?letter=A');
        const data = response.data;

        console.log('Status:', data.status);
        console.log('Current Letter:', data.data.current_letter);
        console.log('Total Anime:', data.data.total);
        console.log('\nAlphabet Navigation:', data.data.alphabet_nav.length, 'letters');
        console.log('First 3 letters:', data.data.alphabet_nav.slice(0, 3).map(l => l.letter).join(', '));

        console.log('\nFirst 3 anime:');
        data.data.anime_list.slice(0, 3).forEach((anime, i) => {
            console.log(`${i + 1}. ${anime.title}`);
            console.log(`   Slug: ${anime.slug}`);
            console.log(`   Type: ${anime.type || 'N/A'}`);
        });

        console.log('\n✅ API test successful!');
    } catch (error) {
        console.error('❌ API test failed:', error.message);
    }
}

testAZListAPI();
