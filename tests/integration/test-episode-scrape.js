const axios = require('axios');
const cheerio = require('cheerio');

async function testEpisodeScrape() {
    const url = 'https://anichin.cafe/supreme-alchemy-episode-167-subtitle-indonesia';

    try {
        console.log('Fetching:', url);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);

        console.log('\n=== TITLE ===');
        console.log('Entry title:', $('.entry-title').text().trim());

        console.log('\n=== VIDEO SECTION ===');
        console.log('Has .megavid:', $('.megavid').length);
        console.log('Has .mvelement:', $('.mvelement').length);

        console.log('\n=== SERVER BUTTONS ===');
        $('.megavid select option, .megavid button, .megavid a[data-em]').each((i, el) => {
            const $el = $(el);
            console.log(`Server ${i}:`, {
                text: $el.text().trim(),
                href: $el.attr('href'),
                dataEm: $el.attr('data-em'),
                dataEp: $el.attr('data-ep')
            });
        });

        console.log('\n=== SELECT VIDEO SERVER ===');
        $('select#changeServer option').each((i, el) => {
            const $el = $(el);
            console.log(`Option ${i}:`, {
                value: $el.attr('value'),
                text: $el.text().trim()
            });
        });

        console.log('\n=== DOWNLOAD SECTION ===');

        // Look for download section in entry-content
        const $content = $('.entry-content');
        let currentQuality = '';

        $content.find('strong, h3, h4, p').each((i, el) => {
            const $el = $(el);
            const text = $el.text().trim();

            // Check if this contains quality info
            if (text.match(/\d+p|360p|480p|720p|1080p/)) {
                currentQuality = text;
                console.log(`\nQuality section: ${currentQuality}`);

                // Get links after this quality
                $el.nextAll('p, div').first().find('a').each((j, link) => {
                    const $link = $(link);
                    console.log(`  - ${$link.text().trim()}: ${$link.attr('href')}`);
                });
            }
        });

        // Also check for simpler pattern
        console.log('\n=== ALL DOWNLOAD LINKS ===');
        $content.find('a[href*="mirror"], a[href*="download"], a[href*="terabox"], a[href*="drive"]').slice(0, 10).each((i, el) => {
            const $el = $(el);
            const prevText = $el.parent().prevAll().find('strong').first().text().trim() ||
                             $el.parent().prev('strong').text().trim() ||
                             $el.closest('p').prevAll('strong').first().text().trim();
            console.log(`Link ${i}:`, {
                quality: prevText,
                provider: $el.text().trim(),
                href: $el.attr('href')
            });
        });

        console.log('\n=== EPISODE LIST ===');
        console.log('Has .eplister:', $('.eplister').length);
        console.log('Has .season:', $('.season').length);
        console.log('Has #sidebar .season:', $('#sidebar .season').length);
        console.log('Has .all-episode:', $('.all-episode').length);
        console.log('Has #sidebar:', $('#sidebar').length);

        // Check for episode links in sidebar
        $('#sidebar a[href*="episode"]').slice(0, 10).each((i, el) => {
            const $el = $(el);
            console.log(`Episode link ${i}:`, {
                href: $el.attr('href'),
                text: $el.text().trim()
            });
        });

        // Check all sidebar sections
        console.log('\n=== SIDEBAR SECTIONS ===');
        $('#sidebar .section').each((i, el) => {
            const $section = $(el);
            console.log(`Section ${i}:`, {
                title: $section.find('h3').text().trim(),
                hasLinks: $section.find('a').length
            });
        });

        console.log('\n=== NAVIGATION ===');
        $('.naveps a, .nvsc a, .pagination a').each((i, el) => {
            const $el = $(el);
            console.log(`Nav ${i}:`, {
                rel: $el.attr('rel'),
                href: $el.attr('href'),
                text: $el.text().trim()
            });
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testEpisodeScrape();
