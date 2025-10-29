const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function debugStructure() {
    try {
        const url = 'https://v8.kuramanime.tel/anime/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga/episode/1';
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        
        // Check for download link section
        console.log('Looking for download link sections...\n');
        
        // Check #animeDownloadLink
        const $downloadSection = $('#animeDownloadLink');
        console.log('1. #animeDownloadLink found:', $downloadSection.length > 0);
        if ($downloadSection.length > 0) {
            console.log('   Content preview:', $downloadSection.html().substring(0, 500));
            console.log('   Children count:', $downloadSection.children().length);
            console.log('   H6 count:', $downloadSection.find('h6').length);
            console.log('   A tag count:', $downloadSection.find('a').length);
        }
        
        // Check downloadLinkSection
        const $dlSection = $('#downloadLinkSection');
        console.log('\n2. #downloadLinkSection found:', $dlSection.length > 0);
        if ($dlSection.length > 0) {
            console.log('   Content preview:', $dlSection.html().substring(0, 500));
        }
        
        // Check for any section with "Unduh" or "Download" in title
        console.log('\n3. Sections with "Unduh" or "Tautan Unduh":');
        $('h5, h6, h4').each((i, el) => {
            const text = $(el).text().trim();
            if (text.includes('Unduh') || text.includes('Download')) {
                console.log(`   - Found: "${text}"`);
                console.log('     Parent class:', $(el).parent().attr('class'));
                console.log('     Parent id:', $(el).parent().attr('id'));
            }
        });
        
        // Find all links that might be download links
        console.log('\n4. Potential download links (checking domains):');
        const downloadDomains = ['pixeldrain', 'kuramadrive', 'mega.co.nz', 'dropbox', 'mypikpak'];
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href) {
                for (const domain of downloadDomains) {
                    if (href.includes(domain)) {
                        const text = $(el).text().trim();
                        const parent = $(el).parent();
                        console.log(`   - ${text}: ${href.substring(0, 80)}...`);
                        console.log(`     Parent tag: ${parent.prop('tagName')}, id: ${parent.attr('id')}, class: ${parent.attr('class')}`);
                        break;
                    }
                }
            }
        });
        
        // Save full HTML to file for inspection
        fs.writeFileSync('/home/droid/animme/debug_episode_structure.html', data);
        console.log('\n✓ Full HTML saved to debug_episode_structure.html');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugStructure();
