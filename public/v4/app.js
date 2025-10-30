// AnimMe V4 - Anichin Application
const API_BASE = '/api/v4/anichin';

// State management
let appState = {
    bannerRecommendations: [],
    popularToday: [],
    latestReleases: [],
    isLoading: false,
    error: null
};

// Initialize app on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('[V4] Initializing Anichin application...');
    initializeApp();
});

// Initialize application
async function initializeApp() {
    try {
        appState.isLoading = true;

        // Load all homepage data
        console.log('[V4] Fetching homepage data...');
        const homepageData = await fetchAPI('/home');

        if (homepageData && homepageData.status === 'success' && homepageData.data) {
            const { banner_recommendations, popular_today, latest_releases } = homepageData.data;

            appState.bannerRecommendations = banner_recommendations || [];
            appState.popularToday = popular_today || [];
            appState.latestReleases = latest_releases || [];

            console.log('[V4] Data loaded:', {
                banners: appState.bannerRecommendations.length,
                popular: appState.popularToday.length,
                latest: appState.latestReleases.length
            });

            // Render sections
            renderBannerRecommendations();
            renderPopularToday();
            renderLatestReleases();
        } else {
            showError('Gagal memuat data homepage');
        }

        // Setup server selector
        setupServerSelector();

    } catch (error) {
        console.error('[V4] Error initializing app:', error);
        showError('Terjadi kesalahan saat memuat data');
    } finally {
        appState.isLoading = false;
    }
}

// Fetch data from API
async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`[V4] API Error (${endpoint}):`, error);
        throw error;
    }
}

// Render banner recommendations carousel
function renderBannerRecommendations() {
    const container = document.getElementById('bannerCarousel');

    if (!appState.bannerRecommendations || appState.bannerRecommendations.length === 0) {
        container.innerHTML = '<p class="loading" style="width: 100%; text-align: center;">Tidak ada banner tersedia</p>';
        return;
    }

    // Clear loading state
    container.innerHTML = '';

    appState.bannerRecommendations.forEach(banner => {
        const item = createBannerElement(banner);
        container.appendChild(item);
    });
}

// Create banner carousel item
function createBannerElement(banner) {
    const div = document.createElement('div');
    div.className = 'carousel-item';

    const backdrop = banner.backdrop || '/images/placeholder.jpg';

    div.innerHTML = `
        <div class="carousel-image" style="background-image: url('${backdrop}');">
            <div class="carousel-overlay">
                <div class="carousel-title">${escapeHtml(banner.title)}</div>
                ${banner.japanese_title ? `<div style="color: #aaa; font-size: 0.8rem;">${escapeHtml(banner.japanese_title)}</div>` : ''}
            </div>
        </div>
    `;

    div.addEventListener('click', () => {
        if (banner.slug) {
            window.location.href = `/v4/detail?slug=${encodeURIComponent(banner.slug)}`;
        }
    });

    return div;
}

// Render popular today section
function renderPopularToday() {
    const section = document.getElementById('popularSection');
    const container = document.getElementById('popularToday');
    const countBadge = document.getElementById('popularCount');

    if (!appState.popularToday || appState.popularToday.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    countBadge.textContent = appState.popularToday.length;

    // Clear loading state
    container.innerHTML = '';

    appState.popularToday.forEach(anime => {
        const card = createAnimeCard(anime);
        container.appendChild(card);
    });
}

// Render latest releases section
function renderLatestReleases() {
    const section = document.getElementById('latestSection');
    const container = document.getElementById('latestReleases');
    const countBadge = document.getElementById('latestCount');

    if (!appState.latestReleases || appState.latestReleases.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    countBadge.textContent = appState.latestReleases.length;

    // Clear loading state
    container.innerHTML = '';

    appState.latestReleases.forEach(anime => {
        const card = createAnimeCard(anime);
        container.appendChild(card);
    });
}

// Create anime card element
function createAnimeCard(anime) {
    const div = document.createElement('div');
    div.className = 'anime-card';

    const poster = anime.poster || '/images/placeholder.jpg';
    const episode = anime.episode ? `<div class="anime-meta"><span>${anime.episode}</span></div>` : '';

    div.innerHTML = `
        <div class="anime-poster" style="background-image: url('${poster}');"></div>
        <div class="anime-info">
            <div class="anime-title">${escapeHtml(anime.title)}</div>
            ${episode}
        </div>
    `;

    div.addEventListener('click', () => {
        if (anime.slug) {
            window.location.href = `/v4/detail?slug=${encodeURIComponent(anime.slug)}`;
        }
    });

    return div;
}

// Show error message
function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.innerHTML = `<div class="error">⚠️ ${message}</div>`;
    errorContainer.style.display = 'block';
    appState.error = message;
}

// Hide error message
function hideError() {
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.style.display = 'none';
    appState.error = null;
}

// Setup server selector dropdown
function setupServerSelector() {
    const selector = document.getElementById('serverSelect');

    selector.addEventListener('change', (e) => {
        const version = e.target.value;
        switch(version) {
            case 'v1':
                window.location.href = '/v1/home';
                break;
            case 'v2':
                window.location.href = '/v2/home';
                break;
            case 'v3':
                window.location.href = '/v3/home';
                break;
            case 'v4':
                window.location.href = '/v4/home';
                break;
        }
    });
}

// Utility function to escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Log app initialization
console.log('[V4] Anichin V4 app loaded');
