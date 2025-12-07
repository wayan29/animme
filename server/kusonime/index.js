// Kusonime V8 Scraper - Main Index

const { BASE_URL, proxyImageUrl, getImageUrlMap, extractSlug, cleanText } = require('./helpers');
const { scrapeHome } = require('./home');
const { scrapeDetail } = require('./detail');
const { scrapeSearch } = require('./search');

module.exports = {
    // Helpers
    BASE_URL,
    proxyImageUrl,
    getImageUrlMap,
    extractSlug,
    cleanText,

    // Scraping functions
    scrapeHome,
    scrapeDetail,
    scrapeSearch
};
