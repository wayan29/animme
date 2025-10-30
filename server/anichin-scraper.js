const axios = require('axios');
const cheerio = require('cheerio');
const ImageProxy = require('./image-proxy');

class AnichinScraper {
    constructor() {
        this.baseUrl = 'https://anichin.cafe';
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
        this.imageProxy = new ImageProxy();
    }

    async fetchPage(url) {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 10000
            });
            return response.data;
        } catch (error) {
            console.error(`[Anichin] Error fetching ${url}:`, error.message);
            throw new Error(`Failed to fetch page: ${error.message}`);
        }
    }

    // Scrape banner recommendations from homepage slider
    async scrapeBannerRecommendations() {
        try {
            console.log('[Anichin] Scraping banner recommendations...');
            const html = await this.fetchPage(this.baseUrl);
            const $ = cheerio.load(html);

            const banners = [];
            
            // Get items from swiper slider
            for (let i = 0; i < $('.swiper-slide.item').length; i++) {
                const $item = $($('.swiper-slide.item')[i]);
                
                // Get backdrop image
                const backdrop = $item.find('.backdrop').css('background-image');
                const backdropUrl = backdrop ? backdrop.replace(/url\(['"]?(.*?)['"]?\)/, '$1') : '';
                
                // Get title and Japanese title
                const titleElement = $item.find('h2 a');
                const title = titleElement.text().trim();
                const japaneseTitle = titleElement.attr('data-jtitle') || '';
                
                // Get URL and slug
                const url = titleElement.attr('href') || '';
                const slug = url.replace(this.baseUrl, '').replace('/seri/', '').replace('/', '');
                
                // Get description
                const description = $item.find('p').text().trim();
                
                // Get watch button URL
                const watchUrl = $item.find('.watch').attr('href') || '';
                
                if (title && url) {
                    // Process backdrop image through proxy
                    const cachedBackdrop = await this.imageProxy.processPosterUrl(backdropUrl);
                    
                    banners.push({
                        title: title,
                        japanese_title: japaneseTitle,
                        slug: slug,
                        url: url,
                        backdrop: cachedBackdrop,
                        description: description,
                        watch_url: watchUrl,
                        type: 'banner'
                    });
                }
            }

            console.log(`[Anichin] Found ${banners.length} banner recommendations`);
            return banners;
        } catch (error) {
            console.error('[Anichin] Error scraping banner recommendations:', error.message);
            return [];
        }
    }

    // Scrape popular today from homepage
    async scrapePopularToday() {
        try {
            console.log('[Anichin] Scraping popular today...');
            const html = await this.fetchPage(this.baseUrl);
            const $ = cheerio.load(html);

            const popularToday = [];
            
            // Look for Popular Today section items
            // The structure shows items with links containing episode information
            const popularLinks = $('.releases.hothome').nextUntil('.releases.latesthome').find('a');
            
            for (let i = 0; i < popularLinks.length; i++) {
                const $item = $(popularLinks[i]);
                const url = $item.attr('href') || '';
                
                // Skip if not an episode link or if it's the "View All" link
                if (!url || url.includes('/seri/?') || url.includes('/page/')) {
                    continue;
                }
                
                // Get title from the link text or nested elements
                let title = '';
                let episode = '';
                let poster = '';
                
                // Try to get title from img alt or text content
                const imgElement = $item.find('img');
                if (imgElement.length) {
                    title = imgElement.attr('alt') || '';
                    poster = imgElement.attr('src') || '';
                }
                
                // Get episode info from text content
                const textContent = $item.text().trim();
                const episodeMatch = textContent.match(/Ep\s*(\d+)/i);
                if (episodeMatch) {
                    episode = `Episode ${episodeMatch[1]}`;
                }
                
                // Extract anime title from episode title
                if (title) {
                    // Remove episode info from title
                    title = title.replace(/Episode\s*\d+\s*Subtitle\s*Indonesia/i, '').trim();
                }
                
                // Get slug from URL - extract anime name from episode URL
                let slug = '';
                const urlParts = url.replace(this.baseUrl, '').replace(/^\//, '').split('/');
                if (urlParts.length > 0) {
                    // Remove episode-specific parts and get anime slug
                    slug = urlParts[0];
                    // Remove common episode patterns
                    slug = slug.replace(/-episode-\d+.*$/, '');
                }
                
                if (title && url) {
                    // Process poster image through proxy
                    const cachedPoster = await this.imageProxy.processPosterUrl(poster);
                    
                    popularToday.push({
                        title: title,
                        slug: slug,
                        url: url,
                        poster: cachedPoster,
                        episode: episode,
                        type: 'Donghua',
                        category: 'popular_today'
                    });
                }
            }

            console.log(`[Anichin] Found ${popularToday.length} popular today items`);
            return popularToday;
        } catch (error) {
            console.error('[Anichin] Error scraping popular today:', error.message);
            return [];
        }
    }

    // Scrape latest releases from homepage
    async scrapeLatestReleases() {
        try {
            console.log('[Anichin] Scraping latest releases...');
            const html = await this.fetchPage(this.baseUrl);
            const $ = cheerio.load(html);

            const latestReleases = [];
            
            // Look for Latest Release section items
            // Similar structure to Popular Today but in the latesthome section
            const latestLinks = $('.releases.latesthome').nextUntil('.releases').find('a');
            
            for (let i = 0; i < latestLinks.length; i++) {
                const $item = $(latestLinks[i]);
                const url = $item.attr('href') || '';
                
                // Skip if not an episode link or if it's the "View All" link
                if (!url || url.includes('/seri/?') || url.includes('/page/')) {
                    continue;
                }
                
                // Get title from the link text or nested elements
                let title = '';
                let episode = '';
                let poster = '';
                
                // Try to get title from img alt or text content
                const imgElement = $item.find('img');
                if (imgElement.length) {
                    title = imgElement.attr('alt') || '';
                    poster = imgElement.attr('src') || '';
                }
                
                // Get episode info from text content
                const textContent = $item.text().trim();
                const episodeMatch = textContent.match(/Ep\s*(\d+)/i);
                if (episodeMatch) {
                    episode = `Episode ${episodeMatch[1]}`;
                }
                
                // Extract anime title from episode title
                if (title) {
                    // Remove episode info from title
                    title = title.replace(/Episode\s*\d+\s*Subtitle\s*Indonesia/i, '').trim();
                }
                
                // Get slug from URL - extract anime name from episode URL
                let slug = '';
                const urlParts = url.replace(this.baseUrl, '').replace(/^\//, '').split('/');
                if (urlParts.length > 0) {
                    // Remove episode-specific parts and get anime slug
                    slug = urlParts[0];
                    // Remove common episode patterns
                    slug = slug.replace(/-episode-\d+.*$/, '');
                }
                
                if (title && url) {
                    // Process poster image through proxy
                    const cachedPoster = await this.imageProxy.processPosterUrl(poster);
                    
                    latestReleases.push({
                        title: title,
                        slug: slug,
                        url: url,
                        poster: cachedPoster,
                        episode: episode,
                        type: 'Donghua',
                        category: 'latest_release'
                    });
                }
            }

            console.log(`[Anichin] Found ${latestReleases.length} latest releases`);
            return latestReleases;
        } catch (error) {
            console.error('[Anichin] Error scraping latest releases:', error.message);
            return [];
        }
    }

    // Get all homepage data in one call
    async scrapeHomepage() {
        try {
            console.log('[Anichin] Scraping complete homepage data...');
            
            const [bannerRecommendations, popularToday, latestReleases] = await Promise.all([
                this.scrapeBannerRecommendations(),
                this.scrapePopularToday(),
                this.scrapeLatestReleases()
            ]);

            return {
                status: 'success',
                data: {
                    banner_recommendations: bannerRecommendations,
                    popular_today: popularToday,
                    latest_releases: latestReleases,
                    total_banners: bannerRecommendations.length,
                    total_popular: popularToday.length,
                    total_latest: latestReleases.length
                }
            };
        } catch (error) {
            console.error('[Anichin] Error scraping homepage:', error.message);
            return {
                status: 'error',
                message: error.message,
                data: {
                    banner_recommendations: [],
                    popular_today: [],
                    latest_releases: []
                }
            };
        }
    }

    // Scrape anime detail page
    async scrapeAnimeDetail(slug) {
        try {
            console.log(`[Anichin] Scraping anime detail for: ${slug}`);
            const url = `${this.baseUrl}/seri/${slug}/`;
            const html = await this.fetchPage(url);
            const $ = cheerio.load(html);

            // Get main title
            const title = $('.entry-title').text().trim();
            
            // Get alternative title
            const alternativeTitle = $('.entry-title').attr('data-jtitle') || '';
            
            // Get poster
            const poster = $('.thumb img').attr('src') || '';
            
            // Get description
            const description = $('.entry-content p').first().text().trim();
            
            // Get info details
            const info = {};
            $('.infox .spe span').each((i, element) => {
                const $span = $(element);
                const label = $span.contents().first().text().trim().replace(':', '');
                const value = $span.find('a').text().trim() || $span.contents().eq(1).text().trim();
                
                if (label && value) {
                    info[label.toLowerCase()] = value;
                }
            });

            // Get episode list
            const episodes = [];
            $('.eplister li').each((i, element) => {
                const $episode = $(element);
                const episodeUrl = $episode.find('a').attr('href') || '';
                const episodeTitle = $episode.find('.epl-num').text().trim();
                const episodeDate = $episode.find('.epl-date').text().trim();
                
                if (episodeUrl) {
                    episodes.push({
                        title: episodeTitle,
                        url: episodeUrl,
                        date: episodeDate
                    });
                }
            });

            return {
                status: 'success',
                data: {
                    title: title,
                    alternative_title: alternativeTitle,
                    slug: slug,
                    poster: poster,
                    description: description,
                    info: info,
                    episodes: episodes,
                    total_episodes: episodes.length
                }
            };
        } catch (error) {
            console.error(`[Anichin] Error scraping anime detail for ${slug}:`, error.message);
            return {
                status: 'error',
                message: error.message,
                data: null
            };
        }
    }
}

module.exports = AnichinScraper;
