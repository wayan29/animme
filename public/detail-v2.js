const API_BASE = '/api/v2';

let currentAnimeData = null;
let currentSlug = null;

// Get slug from URL
function getSlugFromURL() {
    const pathParts = window.location.pathname.split('/');
    
    // Clean URL: /detail-v2/slug-name
    if (pathParts.length >= 3 && pathParts[1] === 'detail-v2' && pathParts[2]) {
        return pathParts[2];
    }
    
    // Fallback to query parameter
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('slug');
}

// Check if user prefers V2
function isV2Server() {
    const savedServer = localStorage.getItem('selectedServer') || 'v1';
    return savedServer === 'v2';
}

// Redirect to V2 detail if user is on V2 server
function checkServerPreference() {
    if (!isV2Server()) {
        const slug = getSlugFromURL();
        if (slug) {
            window.location.href = `/detail-v2/${slug}`;
        }
    }
}

async function fetchAnimeDetail(slug) {
    try {
        const response = await fetch(`${API_BASE}/anime/${slug}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching anime detail:', error);
        showNotification('Error loading anime data');
        return null;
    }
}

function displayAnimeDetail(anime) {
    currentAnimeData = anime;
    
    // Display poster
    const posterContainer = document.getElementById('animePoster');
    if (anime.poster) {
        posterContainer.innerHTML = `
            <img src="${anime.poster}" alt="${anime.title}" class="anime-poster"
                 onerror="this.src='https://via.placeholder.com/300x450/0f0f0f/e50914/222222?text=${encodeURIComponent(anime.title)}'"
                 class="anime-poster">
        `;
    } else {
        posterContainer.innerHTML = `
            <img src="https://via.placeholder.com/300x450/0f0f0f/e50914/222222?text=${encodeURIComponent(anime.title)}" 
                 alt="${anime.title}" class="anime-poster">
        `;
    }
    
    // Display basic info
    document.getElementById('animeTitle').textContent = anime.title || 'Unknown Title';
    
    // Display meta information
    const metaContainer = document.getElementById('animeMeta');
    let metaHTML = '';
    
    if (anime.status) {
        metaHTML += `<div class="meta-item"><span class="meta-label">Status:</span><span class="meta-value">${anime.status}</span></div>`;
    }
    if (anime.type) {
        metaHTML += `<div class="meta-item"><span class="meta-label">Tipe:</span><span class="meta-value">${anime.type}</span></div>`;
    }
    if (anime.episode_count) {
        metaHTML += `<div class="meta-item"><span class="display-label">Total Episode:</span><span class="meta-value">${anime.episode_count}</span></div>`;
    }
    if (anime.studio) {
        metaHTML += `<div class="meta-item"><span class="meta-label">Studio:</span><span class="meta-value">${anime.studio}</span></div>`;
    }
    if (anime.season) {
        metaHTML += `<div class="meta-item"><span class="meta-label">Season:</span><span class="meta-value">${anime.season}</span></div>`;
    }
    if (anime.rating) {
        metaHTML += `<div class="meta-item"><span class="meta-label">Rating:</span><span class="meta-value">${anime.rating}</span></div>`;
    }
    
    if (anime aired_date) {
        metaHTML += `<div class="meta-item"><span class="meta-label">Tayang:</span><span class="meta-value">${anime.aired_date}</span></div>`;
    }
    
    metaContainer.innerHTML = metaHTML;
    
    // Display synopsis
    const synopsisContainer = document.getElementById('animeSynopsis');
    synopsisContainer.querySelector('p').textContent = anime.synopsis || 'Tidak ada sinopsis tersedia.';
    
    // Display episodes
    displayEpisodeList(anime.episode_lists || []);
    
    // Display related anime
    displayRelatedAnime();
}

function displayEpisodeList(episodes) {
    const episodeContainer = document.getElementById('animeEpisodes');
    
    if (!episodes || episodes.length === 0) {
        episodeContainer.innerHTML = '<div class="loading">No episodes available.</div>';
        return;
    }
    
    const episodesHTML = episodes.map(episode => {
        return `
            <div class="episode-item" onclick="goToEpisode('${episode.slug}')">
                <div class="episode-number">${episode.episode_number || episode.episode_title}</div>
                <div class="episode-title">${episode.episode_title || 'Untitled'}</div>
                <div class="episode-date">${episode.release_date || ''}</div>
            </div>
        `;
    }).join('');
    
    episodeContainer.innerHTML = episodesHTML;
}

async function displayRelatedAnime() {
    const relatedContainer = document.getElementById('relatedAnime');
    const slug = currentSlug;
    
    if (!slug) {
        relatedContainer.innerHTML = '<div class="loading">Loading related anime...</div>';
        return;
    }
    
    try {
        // Use search to find related anime (same genre anime)
        const response = await fetchAnimeDetail('');
        
        if (response && response.status === 'success' && response.data) {
            relatedContainer.innerHTML = '<div class="loading">No related anime available.</div>';
        }
    } catch (error) {
        relatedContainer.innerHTML = '<div class="error">Failed to load related anime.</div>';
    }
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function goBack() {
    // Check if there's a referrer
    if (document.referrer && document.referrer !== window.location.href) {
        window.history.back();
    } else {
        window.location.href = '/';
    }
}

function goToEpisode(episodeSlug) {
    if (episodeSlug) {
        window.location.href = `/player/${episodeSlug}`;
    }
}

async function loadAnimeDetailPage() {
    const slug = getSlugFromURL();
    
    if (!slug) {
        showError('Slug tidak ditemukan');
        return;
    }
    
    showLoading('Loading anime detail...');
    
    const data = await fetchAnimeDetail(slug);
    
    hideLoading();
    
    if (data && data.status === 'success' && data.data) {
        currentSlug = slug;
        displayAnimeDetail(data.data);
        document.title = `${data.data.title} - AnimMe V2`;
    } else {
        showError('Gagal memuat detail anime');
    }
}

function showLoading(message) {
    const loadingElements = document.querySelectorAll('.loading');
    loadingElements.forEach(el => el.textContent = message);
}

function hideLoading() {
    const loadingElements = document.querySelectorAll('.loading');
    loadingElements.forEach(el => {
        el.textContent = '';
        });
}

function showError(message) {
    const detailContainer = document.querySelector('.detail-container');
    if (detailContainer) {
        detailContainer.innerHTML = `<div class="error">${message}</div>`;
    }
}

function searchAnime() {
    const query = document.getElementById('searchInput').value.trim();
    if (query) {
        window.location.href = `/search/${query}?server=v2`;
    }
}

// Handle Enter key in search input
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchAnime();
            }
        });
    }
});

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    loadAnimeDetailPage();
});
