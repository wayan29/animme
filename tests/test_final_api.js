const { scrapeDetail } = require('../server/kuramanime');

async function testFinalAPI() {
    try {
        console.log('=== FINAL API TEST: scrapeDetail ===\n');
        console.log('URL: https://v8.kuramanime.tel/anime/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga\n');
        
        const result = await scrapeDetail('4081', 'ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga');
        
        console.log('=== RESPONSE STRUCTURE ===\n');
        console.log('Fields in response:');
        Object.keys(result).forEach(key => {
            const value = result[key];
            let type = typeof value;
            let preview = '';
            
            if (Array.isArray(value)) {
                type = 'array';
                preview = `(${value.length} items)`;
            } else if (type === 'string') {
                preview = value.length > 50 ? `"${value.substring(0, 50)}..."` : `"${value}"`;
            } else if (type === 'object') {
                preview = `(${Object.keys(value).length} keys)`;
            }
            
            console.log(`  ✓ ${key}: ${type} ${preview}`);
        });
        
        console.log('\n\n=== DETAIL BREAKDOWN ===\n');
        
        console.log(`Title: ${result.title}`);
        console.log(`Poster: ${result.poster ? '✓ Found' : '✗ Missing'}`);
        console.log(`Synopsis: ${result.synopsis.substring(0, 100)}...`);
        console.log(`Genres: ${result.genres.length} items`);
        console.log(`Info fields: ${Object.keys(result.info).length} fields`);
        
        console.log(`\n--- Episodes (${result.episodes.length}) ---`);
        if (result.episodes.length > 0) {
            result.episodes.forEach((ep, i) => {
                console.log(`  ${i + 1}. ${ep.title} - ${ep.url}`);
            });
        } else {
            console.log('  ⚠ No episodes found');
        }
        
        console.log(`\n--- Anime Lainnya (${result.anime_lainnya.length}) ---`);
        if (result.anime_lainnya.length > 0) {
            result.anime_lainnya.forEach((anime, i) => {
                console.log(`  ${i + 1}. ${anime.title}`);
                console.log(`     Poster: ${anime.poster ? '✓' : '✗'} | Rating: ${anime.rating} | Quality: ${anime.quality}`);
            });
        } else {
            console.log('  ⚠ No recommendations found');
        }
        
        console.log('\n\n=== VALIDATION ===\n');
        
        const checks = [
            { name: 'Title present', pass: !!result.title },
            { name: 'Poster present', pass: !!result.poster },
            { name: 'Synopsis present', pass: !!result.synopsis },
            { name: 'Has episodes', pass: result.episodes.length > 0 },
            { name: 'Has anime_lainnya', pass: result.anime_lainnya.length > 0 },
            { name: 'All episodes have URL', pass: result.episodes.every(ep => ep.url) },
            { name: 'All recommendations have poster', pass: result.anime_lainnya.every(a => a.poster) }
        ];
        
        checks.forEach(check => {
            console.log(`${check.pass ? '✓' : '✗'} ${check.name}`);
        });
        
        const allPassed = checks.every(c => c.pass);
        
        console.log('\n=== RESULT ===\n');
        if (allPassed) {
            console.log('✓ ALL CHECKS PASSED! API is working correctly.');
        } else {
            console.log('⚠ Some checks failed. Review the output above.');
        }
        
        console.log('\n=== SAMPLE JSON RESPONSE ===\n');
        console.log(JSON.stringify({
            status: 'success',
            data: {
                title: result.title,
                poster: result.poster,
                synopsis: result.synopsis.substring(0, 100) + '...',
                genres: result.genres.slice(0, 3),
                episodes: result.episodes.map(ep => ({
                    title: ep.title,
                    url: ep.url
                })),
                anime_lainnya: result.anime_lainnya.map(a => ({
                    title: a.title,
                    anime_id: a.anime_id,
                    slug: a.slug,
                    poster: a.poster,
                    rating: a.rating,
                    quality: a.quality,
                    url: a.url
                }))
            }
        }, null, 2));
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

testFinalAPI();
