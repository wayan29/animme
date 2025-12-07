// Kusonime V8 Frontend

const API_BASE = '/api/v8/kusonime';

// Fetch API helper
async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

// Load homepage
async function loadHomePage() {
    const latestContainer = document.getElementById('latestAnime');

    try {
        const data = await fetchAPI('/home');

        if (!data || !data.data) {
            latestContainer.innerHTML = '<div class="error">Gagal memuat data anime</div>';
            return;
        }

        const animeList = data.data.latest_releases || [];

        if (animeList.length === 0) {
            latestContainer.innerHTML = '<div class="error">Tidak ada anime tersedia</div>';
            return;
        }

        // Display anime
        latestContainer.innerHTML = animeList.map(anime => `
            <div class="anime-card" onclick="goToDetail('${anime.slug}')">
                <div class="anime-thumb">
                    <img src="${anime.poster || 'https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image'}"
                         alt="${anime.title}"
                         onerror="this.src='https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image'">
                </div>
                <div class="anime-info">
                    <div class="anime-title" title="${anime.title}">${anime.title}</div>
                    <div class="anime-meta">
                        ${anime.release_date || 'Unknown'}
                        ${anime.resolution ? ' • ' + anime.resolution : ''}
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading homepage:', error);
        latestContainer.innerHTML = '<div class="error">Gagal memuat data anime</div>';
    }
}

// Go to detail page
function goToDetail(slug) {
    if (slug) {
        window.location.href = `/v8/detail.html?slug=${slug}`;
    }
}

// Search anime
async function searchAnime() {
    const searchInput = document.getElementById('searchInput');
    const keyword = searchInput.value.trim();

    if (!keyword) {
        alert('Masukkan kata kunci pencarian!');
        return;
    }

    window.location.href = `/v8/search.html?q=${encodeURIComponent(keyword)}`;
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/v8/')) {
        loadHomePage();
    }
});
