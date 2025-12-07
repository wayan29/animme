// Kusonime V8 Scraper - Detail Page

const axios = require('axios');
const cheerio = require('cheerio');
const { BASE_URL, proxyImageUrl, extractSlug, cleanText } = require('./helpers');

async function scrapeDetail(slug) {
    try {
        const url = `${BASE_URL}/${slug}/`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(data);
        const result = {};

        // Get title
        result.title = cleanText($('.entry-title, h1.title').first().text());

        // Get poster
        const $img = $('.post-thumb img, .attachment-post-thumbnail').first();
        result.poster = proxyImageUrl($img.attr('src') || $img.attr('data-src'));

        // Get info from info section
        const $info = $('.info');

        // Extract various metadata
        result.japanese_title = cleanText($info.find('p:contains("Japanese")').text().replace('Japanese:', ''));
        result.genres = [];
        $info.find('p:contains("Genre") a, .genre a').each((i, el) => {
            result.genres.push(cleanText($(el).text()));
        });

        result.season = cleanText($info.find('p:contains("Season")').text().replace('Season:', ''));
        result.producer = cleanText($info.find('p:contains("Produser")').text().replace('Produser:', ''));
        result.type = cleanText($info.find('p:contains("Type")').text().replace('Type:', ''));
        result.status = cleanText($info.find('p:contains("Status")').text().replace('Status:', ''));
        result.total_episode = cleanText($info.find('p:contains("Total Episode")').text().replace('Total Episode:', ''));
        result.score = cleanText($info.find('p:contains("Score")').text().replace('Score:', ''));
        result.duration = cleanText($info.find('p:contains("Duration")').text().replace('Duration:', ''));
        result.release_date = cleanText($info.find('p:contains("Released on")').text().replace('Released on:', ''));

        // Get synopsis
        const $synopsis = $('.lexot p').first();
        result.synopsis = cleanText($synopsis.text());

        // Get download links
        result.download_links = {};
        $('.download-link, .smokeddl, .soraddl').each((i, section) => {
            const $section = $(section);
            const quality = cleanText($section.find('strong, .smokeurl strong').first().text());

            const links = [];
            $section.find('a').each((j, link) => {
                const $link = $(link);
                links.push({
                    host: cleanText($link.text()),
                    url: $link.attr('href')
                });
            });

            if (quality && links.length > 0) {
                result.download_links[quality] = links;
            }
        });

        return {
            status: 'success',
            data: result
        };
    } catch (error) {
        console.error('[Kusonime] Error scraping detail:', error.message);
        throw error;
    }
}

module.exports = {
    scrapeDetail
};
