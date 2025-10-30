const express = require('express');
const AnichinScraper = require('./server/anichin-scraper');

const app = express();
const PORT = 5001;

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Test route
app.get('/test', async (req, res) => {
    try {
        console.log('Testing Anichin scraper...');
        const scraper = new AnichinScraper();
        const data = await scraper.scrapeBannerRecommendations();
        
        res.json({
            status: 'success',
            message: 'Test successful',
            data: data,
            total: data.length
        });
    } catch (error) {
        console.error('Test error:', error.message);
        console.error('Full stack:', error.stack);
        res.status(500).json({
            status: 'error',
            message: error.message,
            stack: error.stack
        });
    }
});

app.listen(PORT, () => {
    console.log(`Test server running on http://localhost:${PORT}`);
    console.log(`Test endpoint: http://localhost:${PORT}/test`);
});
