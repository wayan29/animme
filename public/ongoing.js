const API_BASE = '/api';
const PLACEHOLDER_POSTER = 'https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image';

function handlePosterError(event) {
    const img = event.target;
    const original = img.dataset.original;
    if (original && img.src !== original) {
        img.src = original;
        return;
    }
    if (img.src !== PLACEHOLDER_POSTER) {
        img.src = PLACEHOLDER_POSTER;
    }
}

function getPosterSrc(anime) {
    return anime.poster || anime.poster_original || PLACEHOLDER_POSTER;
}

function escapeAttribute(value) {
    if (!value) return '';
    return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeHtml(value) {
    if (!value) return '';
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildEpisodeInfo(anime) {
    const parts = [];
    parts.push(anime.current_episode ? `Ep ${anime.current_episode}` : 'Episode N/A');
    if (anime.release_day) {
        parts.push(anime.release_day);
    } else if (anime.release_date) {
        parts.push(anime.release_date);
    }
    return escapeHtml(parts.join(' • '));
}

function buildAnimeCard(anime) {
    const titleRaw = anime.title || 'Anime';
    const titleHtml = escapeHtml(titleRaw);
    const titleAttr = escapeAttribute(titleRaw);
    const episodeInfo = buildEpisodeInfo(anime);
    const posterSrc = escapeAttribute(getPosterSrc(anime));
    const posterOriginal = escapeAttribute(anime.poster_original);
    const slug = escapeAttribute(anime.slug);
    const updateInfo = anime.release_date ? `<div class="anime-date">Update: ${escapeHtml(anime.release_date)}</div>` : '';
    
    return `
        <div class="anime-card anime-list-item" data-slug="${slug}" onclick="goToDetail(this.dataset.slug)">
            <div class="anime-thumb">
                <img src="${posterSrc}" 
                     data-original="${posterOriginal}"
                     alt="${titleAttr}" 
                     class="anime-poster"
                     onerror="handlePosterError(event)">
            </div>
            <div class="anime-info">
                <div class="anime-title" title="${titleAttr}">${titleHtml}</div>
                <div class="anime-meta">${episodeInfo}</div>
                ${updateInfo}
            </div>
        </div>
    `;
}

let currentPage = 1;
let paginationData = null;

async function fetchOngoingAnime(page = 1) {
    try {
        const response = await fetch(`${API_BASE}/ongoing-anime/${page}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Fetched data:', data);
        return data;
    } catch (error) {
        console.error('Error fetching ongoing anime:', error);
        return null;
    }
}

function displayOngoingAnime(animeList) {
    const container = document.getElementById('ongoingContainer');
    
    if (!animeList || animeList.length === 0) {
        container.innerHTML = '<div class="error">Tidak ada data anime ongoing</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="anime-list">
            ${animeList.map(buildAnimeCard).join('')}
        </div>
    `;
}

function displayPagination(pagination) {
    const container = document.getElementById('paginationContainer');
    
    if (!pagination) {
        container.style.display = 'none';
        return;
    }
    
    paginationData = pagination;
    container.style.display = 'flex';
    
    const maxButtons = 5;
    const currentPage = pagination.current_page;
    const lastPage = pagination.last_page || pagination.total_pages || pagination.last_visible_page;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(lastPage, startPage + maxButtons - 1);
    
    if (endPage - startPage + 1 < maxButtons) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }
    
    let paginationHTML = '';
    
    // Previous button
    if (pagination.has_previous_page) {
        paginationHTML += `<button class="pagination-btn" onclick="loadPage(${pagination.previous_page})">‹ Prev</button>`;
    } else {
        paginationHTML += `<button class="pagination-btn disabled" disabled>‹ Prev</button>`;
    }
    
    // First page
    if (startPage > 1) {
        paginationHTML += `<button class="pagination-btn" onclick="loadPage(1)">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span class="pagination-dots">...</span>`;
        }
    }
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            paginationHTML += `<button class="pagination-btn active">${i}</button>`;
        } else {
            paginationHTML += `<button class="pagination-btn" onclick="loadPage(${i})">${i}</button>`;
        }
    }
    
    // Last page
    if (endPage < lastPage) {
        if (endPage < lastPage - 1) {
            paginationHTML += `<span class="pagination-dots">...</span>`;
        }
        paginationHTML += `<button class="pagination-btn" onclick="loadPage(${lastPage})">${lastPage}</button>`;
    }
    
    // Next button
    if (pagination.has_next_page) {
        paginationHTML += `<button class="pagination-btn" onclick="loadPage(${pagination.next_page})">Next ›</button>`;
    } else {
        paginationHTML += `<button class="pagination-btn disabled" disabled>Next ›</button>`;
    }
    
    // Wrap pagination buttons in pagination-buttons div for proper styling
    const wrappedPaginationHTML = `
        <div class="pagination-buttons">${paginationHTML}</div>
    `;
    
    container.innerHTML = wrappedPaginationHTML;
}

async function loadPage(page) {
    currentPage = page;
    
    const container = document.getElementById('ongoingContainer');
    container.innerHTML = '<div class="loading">Memuat halaman ' + page + '...</div>';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    const response = await fetchOngoingAnime(page);
    
    if (response && response.status === 'success' && response.data) {
        // Check if data has pagination structure or is direct array
        if (response.data.ongoingAnimeData) {
            // New scraper format with pagination
            displayOngoingAnime(response.data.ongoingAnimeData);
            displayPagination(response.data.paginationData);
        } else {
            // Fallback: direct array format
            displayOngoingAnime(response.data);
            displayPagination(null);
        }
    } else {
        container.innerHTML = '<div class="error">Gagal memuat data anime ongoing</div>';
    }
}

function goToDetail(slug) {
    if (slug) {
        window.location.href = `/detail/${slug}`;
    }
}

async function loadOngoingPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const page = parseInt(urlParams.get('page')) || 1;
    
    await loadPage(page);
}

document.addEventListener('DOMContentLoaded', () => {
    loadOngoingPage();
});
