const API_BASE = '/api';

let currentPage = 1;
let currentGenreSlug = '';
let currentGenreName = '';

async function fetchAnimeByGenre(slug, page = 1) {
    try {
        const response = await fetch(`${API_BASE}/genre/${slug}/${page}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching anime by genre:', error);
        return null;
    }
}

function displayAnimeByGenre(animeList) {
    const container = document.getElementById('genreAnimeContainer');
    
    if (!animeList || animeList.length === 0) {
        container.innerHTML = '<div class="error">Tidak ada anime untuk genre ini</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="anime-grid">
            ${animeList.map(anime => {
                const genresList = anime.genres && anime.genres.length > 0 
                    ? anime.genres.map(g => g.name).slice(0, 3).join(', ')
                    : 'N/A';
                
                return `
                    <div class="anime-card" onclick="goToDetail('${anime.slug}')">
                        <img src="${anime.poster || 'https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image'}" 
                             alt="${anime.title}" 
                             class="anime-poster"
                             onerror="this.src='https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image'">
                        <div class="anime-info">
                            <div class="anime-title" title="${anime.title}">${anime.title}</div>
                            <div class="anime-meta">
                                ${anime.rating ? `⭐ ${anime.rating}` : 'No rating'}
                                ${anime.episode_count ? ` • ${anime.episode_count}` : ''}
                            </div>
                            ${anime.release_date ? `<div class="anime-date">${anime.release_date}</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function displayPagination(pagination) {
    const container = document.getElementById('paginationContainer');
    
    if (!pagination) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'flex';
    
    const maxButtons = 5;
    const currentPage = pagination.current_page;
    const lastPage = pagination.last_visible_page;
    
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
    
    container.innerHTML = paginationHTML;
}

async function loadPage(page) {
    currentPage = page;
    
    const container = document.getElementById('genreAnimeContainer');
    container.innerHTML = '<div class="loading">Memuat halaman ' + page + '...</div>';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    const data = await fetchAnimeByGenre(currentGenreSlug, page);
    
    if (data && data.data) {
        displayAnimeByGenre(data.data.genreAnimeData);
        displayPagination(data.data.paginationData);
    } else {
        container.innerHTML = '<div class="error">Gagal memuat data anime</div>';
    }
}

function goToDetail(slug) {
    if (slug) {
        window.location.href = `/detail/${slug}`;
    }
}

async function loadGenrePage() {
    const pathParts = window.location.pathname.split('/');
    const urlParams = new URLSearchParams(window.location.search);
    
    // Support both clean URL and query parameter
    if (pathParts.length >= 3 && pathParts[1] === 'genre' && pathParts[2]) {
        currentGenreSlug = pathParts[2]; // /genre/:slug
    } else {
        currentGenreSlug = urlParams.get('slug'); // ?slug=action
    }
    
    currentGenreName = urlParams.get('name') || currentGenreSlug;
    const page = parseInt(urlParams.get('page')) || 1;
    
    if (!currentGenreSlug) {
        window.location.href = 'genres';
        return;
    }
    
    // Update header
    document.getElementById('genreName').textContent = `Genre: ${currentGenreName}`;
    document.getElementById('genreDescription').textContent = `Daftar anime dengan genre ${currentGenreName}`;
    document.title = `Genre ${currentGenreName} - AnimMe`;
    
    await loadPage(page);
}

document.addEventListener('DOMContentLoaded', () => {
    loadGenrePage();
});
