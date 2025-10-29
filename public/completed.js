const API_BASE = '/api';

let currentPage = 1;
let paginationData = null;

async function fetchCompletedAnime(page = 1) {
    try {
        const response = await fetch(`${API_BASE}/complete-anime/${page}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching completed anime:', error);
        return null;
    }
}

function displayCompletedAnime(animeList) {
    const container = document.getElementById('completedContainer');
    
    if (!animeList || animeList.length === 0) {
        container.innerHTML = '<div class="error">Tidak ada data anime tamat</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="anime-list">
            ${animeList.map(anime => `
                <div class="anime-card anime-list-item" onclick="goToDetail('${anime.slug}')">
                    <div class="anime-thumb">
                        <img src="${anime.poster || 'https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image'}" 
                             alt="${anime.title}" 
                             class="anime-poster"
                             onerror="this.src='https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image'">
                    </div>
                    <div class="anime-info">
                        <div class="anime-title" title="${anime.title}">${anime.title}</div>
                        <div class="anime-meta">
                            ${anime.episode_count || 'N/A'} Episode
                            ${anime.rating ? ` • ⭐ ${anime.rating}` : ''}
                        </div>
                        ${anime.release_date ? `<div class="anime-date">Tamat: ${anime.release_date}</div>` : ''}
                    </div>
                </div>
            `).join('')}
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
    
    const container = document.getElementById('completedContainer');
    container.innerHTML = '<div class="loading">Memuat halaman ' + page + '...</div>';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    const response = await fetchCompletedAnime(page);
    
    if (response && response.status === 'success' && response.data) {
        // Check if data has pagination structure or is direct array
        if (response.data.completedAnimeData) {
            // New scraper format with pagination
            displayCompletedAnime(response.data.completedAnimeData);
            displayPagination(response.data.paginationData);
        } else {
            // Fallback: direct array format
            displayCompletedAnime(response.data);
            displayPagination(null);
        }
    } else {
        container.innerHTML = '<div class="error">Gagal memuat data anime tamat</div>';
    }
}

function goToDetail(slug) {
    if (slug) {
        window.location.href = `/detail/${slug}`;
    }
}

async function loadCompletedPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const page = parseInt(urlParams.get('page')) || 1;
    
    await loadPage(page);
}

document.addEventListener('DOMContentLoaded', () => {
    loadCompletedPage();
});
