const cheerio = require('cheerio');
const fs = require('fs');

function testParseResHtml() {
    console.log('Testing download link extraction from res.html...\n');
    
    try {
        const html = fs.readFileSync('/home/droid/animme/server/res.html', 'utf8');
        const $ = cheerio.load(html);
        
        const downloadLinks = [];
        
        // Extract download links from #animeDownloadLink section
        const $downloadSection = $('#animeDownloadLink');
        console.log('Found #animeDownloadLink section:', $downloadSection.length > 0);
        
        if ($downloadSection.length > 0) {
            let currentQuality = '';
            let currentSize = '';
            let currentFormat = '';
            
            $downloadSection.children().each((i, el) => {
                const $el = $(el);
                
                // Check if this is a quality/format header (h6 tag)
                if ($el.is('h6')) {
                    const headerText = $el.text().trim();
                    console.log(`Found quality header: ${headerText}`);
                    
                    // Extract format (MKV, MP4)
                    const formatMatch = headerText.match(/^(MKV|MP4)/i);
                    currentFormat = formatMatch ? formatMatch[1].toUpperCase() : '';
                    
                    // Extract quality (480p, 720p, 1080p, etc.)
                    const qualityMatch = headerText.match(/(\d+p)/i);
                    currentQuality = qualityMatch ? qualityMatch[1] : '';
                    
                    // Extract sub type (Softsub, Hardsub)
                    const subType = headerText.match(/\((Softsub|Hardsub)\)/i);
                    const subTypeStr = subType ? subType[1] : '';
                    
                    // Extract size (112.93 MB, etc.)
                    const sizeMatch = headerText.match(/—\s*\(([^)]+)\)/);
                    currentSize = sizeMatch ? sizeMatch[1].trim() : '';
                    
                    // Build full quality string
                    currentQuality = `${currentFormat} ${currentQuality}${subTypeStr ? ' (' + subTypeStr + ')' : ''}`.trim();
                }
                // Check if this is a download link (a tag)
                else if ($el.is('a')) {
                    const href = $el.attr('href');
                    const linkText = $el.text().trim();
                    
                    if (href && linkText) {
                        downloadLinks.push({
                            quality: currentQuality,
                            size: currentSize,
                            provider: linkText,
                            url: href
                        });
                    }
                }
            });
        }
        
        console.log(`\n✓ Found ${downloadLinks.length} download links\n`);
        
        if (downloadLinks.length > 0) {
            // Group by quality
            const grouped = {};
            downloadLinks.forEach(link => {
                if (!grouped[link.quality]) {
                    grouped[link.quality] = [];
                }
                grouped[link.quality].push(link);
            });
            
            // Display grouped
            for (const [quality, links] of Object.entries(grouped)) {
                console.log(`${quality} — ${links[0].size}`);
                links.forEach(link => {
                    console.log(`  - ${link.provider}: ${link.url.substring(0, 60)}...`);
                });
                console.log('');
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

testParseResHtml();
