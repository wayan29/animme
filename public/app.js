const API_BASE = '/api';

let homeData = null;

window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

async function loadHomePage() {
    const data = await fetchAPI('/home');
    if (!data || !data.data) {
        showError('ongoingAnime');
        showError('completedAnime');
        return;
    }
    
    homeData = data;
    
    // Display featured anime from ongoing
    if (data.data.ongoing_anime && data.data.ongoing_anime.length > 0) {
        displayFeaturedAnime(data.data.ongoing_anime[0]);
    }
    
    // Display ongoing anime list
    if (data.data.ongoing_anime && data.data.ongoing_anime.length > 0) {
        displayAnimeList('ongoingAnime', data.data.ongoing_anime, 'ongoing');
    } else {
        showError('ongoingAnime');
    }
    
    // Display completed anime list
    if (data.data.complete_anime && data.data.complete_anime.length > 0) {
        displayAnimeList('completedAnime', data.data.complete_anime, 'completed');
    } else {
        showError('completedAnime');
    }
}

function displayFeaturedAnime(anime) {
    const heroSection = document.getElementById('heroSection');
    const heroTitle = document.getElementById('heroTitle');
    const heroDescription = document.getElementById('heroDescription');
    const heroPlayBtn = document.getElementById('heroPlayBtn');
    const heroInfoBtn = document.getElementById('heroInfoBtn');
    
    if (anime.poster) {
        heroSection.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${anime.poster})`;
    }
    
    heroTitle.textContent = anime.title || 'Anime Unggulan';
    
    // Create description from available data
    let description = 'Tonton anime terbaru dan terpopuler di AnimMe';
    if (anime.synopsis) {
        description = anime.synopsis;
    } else if (anime.current_episode || anime.release_day) {
        description = `${anime.current_episode || ''} ${anime.release_day ? '• Rilis setiap ' + anime.release_day : ''}`;
    }
    heroDescription.textContent = description;
    
    heroPlayBtn.onclick = () => {
        if (anime.slug) {
            window.location.href = `/detail/${anime.slug}`;
        }
    };
    
    heroInfoBtn.onclick = () => {
        if (anime.slug) {
            window.location.href = `/detail/${anime.slug}`;
        }
    };
}

function displayAnimeList(containerId, animeList, type = 'ongoing') {
    const container = document.getElementById(containerId);
    
    if (!animeList || animeList.length === 0) {
        container.innerHTML = '<div class="error">Tidak ada data anime</div>';
        return;
    }
    
    container.innerHTML = animeList.map(anime => {
        // Determine episode info based on type
        let episodeInfo = '';
        if (type === 'ongoing') {
            episodeInfo = anime.current_episode || 'Episode N/A';
            if (anime.release_day) {
                episodeInfo += ` • ${anime.release_day}`;
            }
        } else if (type === 'completed') {
            episodeInfo = `${anime.episode_count || 'N/A'} Episode`;
            if (anime.rating) {
                episodeInfo += ` • ⭐ ${anime.rating}`;
            }
        } else {
            episodeInfo = anime.current_episode || anime.episode_count || 'Episode N/A';
        }
        
        return `
            <div class="anime-card" onclick="goToDetail('${anime.slug}')">
                <img src="${anime.poster || 'https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image'}" 
                     alt="${anime.title}" 
                     class="anime-poster"
                     onerror="this.src='https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image'">
                <div class="anime-info">
                    <div class="anime-title" title="${anime.title}">${anime.title}</div>
                    <div class="anime-meta">${episodeInfo}</div>
                </div>
            </div>
        `;
    }).join('');
}

function goToDetail(slug) {
    if (slug) {
        window.location.href = `/detail/${slug}`;
    }
}

function showError(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '<div class="error">Gagal memuat data</div>';
    }
}

function searchAnime() {
    const searchInput = document.getElementById('searchInput');
    const keyword = searchInput.value.trim();
    
    if (!keyword) {
        alert('Masukkan kata kunci pencarian!');
        return;
    }
    
    // Redirect to search page with clean URL
    window.location.href = `/search/${encodeURIComponent(keyword)}`;
}

document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchAnime();
    }
});

// Mobile search toggle
function initMobileSearch() {
    const searchIconBtn = document.getElementById('searchIconBtn');
    const searchCloseBtn = document.getElementById('searchCloseBtn');
    const searchContainer = document.querySelector('.search-container');
    const searchInput = document.getElementById('searchInput');
    
    if (searchIconBtn) {
        searchIconBtn.addEventListener('click', () => {
            searchContainer.classList.add('active');
            setTimeout(() => searchInput.focus(), 100);
        });
    }
    
    if (searchCloseBtn) {
        searchCloseBtn.addEventListener('click', () => {
            searchContainer.classList.remove('active');
            searchInput.value = '';
        });
    }
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchContainer.classList.contains('active')) {
            searchContainer.classList.remove('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadHomePage();
    initMobileSearch();
});
