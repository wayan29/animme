// Server configuration
let currentServer = localStorage.getItem('selectedServer') || 'v1';
let API_BASE = currentServer === 'v2' ? '/api/v2' : '/api';
let currentPage = 1;
let paginationData = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const serverParam = urlParams.get('server');
    const genreParam = urlParams.get('genre');
    
    // Override server if specified in URL
    if (serverParam) {
        currentServer = serverParam;
        localStorage.setItem('selectedServer', serverParam);
        API_BASE = serverParam === 'v2' ? '/api/v2' : '/api';
    }
    
    const serverSelect = document.getElementById('serverSelect');
    if (serverSelect) {
        serverSelect.value = currentServer;
        serverSelect.addEventListener('change', (e) => {
            changeServer(e.target.value);
        });
    }
    
    applyServerClass(currentServer);
    
    // Pre-fill genre filter if specified in URL
    if (genreParam && currentServer === 'v2') {
        setTimeout(() => {
            const genreCheckbox = document.querySelector(`input[name="genre"][value="${genreParam}"]`);
            if (genreCheckbox) {
                genreCheckbox.checked = true;
                updateGenreButtonText();
            }
        }, 100);
    }
    
    loadAllAnimePage();
});

function applyServerClass(server) {
    document.body.classList.remove('server-v1', 'server-v2');
    document.body.classList.add(server === 'v2' ? 'server-v2' : 'server-v1');
}

function changeServer(server) {
    currentServer = server;
    localStorage.setItem('selectedServer', server);
    API_BASE = server === 'v2' ? '/api/v2' : '/api';
    
    applyServerClass(server);
    loadAllAnimePage();
}

async function fetchAllAnimeV1() {
    try {
        const response = await fetch(`${API_BASE}/all-anime`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching all anime V1:', error);
        return null;
    }
}

async function fetchAllAnimeV2(filters = {}, page = 1) {
    try {
        const params = new URLSearchParams();
        if (page > 1) params.append('page', page);
        if (filters.title) params.append('title', filters.title);
        if (filters.status) params.append('status', filters.status);
        if (filters.type) params.append('type', filters.type);
        if (filters.order) params.append('order', filters.order);
        if (filters.genre && Array.isArray(filters.genre)) {
            filters.genre.forEach(g => params.append('genre', g));
        }
        
        const queryString = params.toString();
        const url = queryString ? `${API_BASE}/all-anime?${queryString}` : `${API_BASE}/all-anime`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching all anime V2:', error);
        return null;
    }
}

function createAlphabetNav(animeData) {
    const alphabetNav = document.getElementById('alphabetNav');
    
    if (!animeData || animeData.length === 0) {
        alphabetNav.innerHTML = '';
        return;
    }
    
    const letters = animeData.map(group => group.letter);
    
    alphabetNav.innerHTML = `
        <div class="alphabet-nav-container">
            ${letters.map(letter => `
                <a href="#section-${letter}" class="alphabet-btn">${letter}</a>
            `).join('')}
        </div>
    `;
}

// Display V1 format (grouped by letter)
function displayAllAnimeV1(animeData) {
    const container = document.getElementById('allAnimeContainer');
    
    if (!animeData || animeData.length === 0) {
        container.innerHTML = '<div class="error">Tidak ada data anime</div>';
        return;
    }
    
    container.innerHTML = animeData.map(group => `
        <div class="anime-letter-section" id="section-${group.letter}">
            <h2 class="letter-header">${group.letter}</h2>
            <div class="anime-list-grid">
                ${group.anime && group.anime.length > 0 
                    ? group.anime.map(anime => `
                        <div class="anime-list-item" onclick="goToDetail('${anime.slug}', 'v1')">
                            <span class="anime-list-title">${anime.title}</span>
                            <span class="anime-list-arrow">→</span>
                        </div>
                    `).join('')
                    : '<p class="no-anime">Tidak ada anime</p>'
                }
            </div>
        </div>
    `).join('');
}

// Display V2 format (card grid)
function displayAllAnimeV2(animeData) {
    const container = document.getElementById('allAnimeContainer');
    
    if (!animeData || animeData.length === 0) {
        container.innerHTML = '<div class="error">Tidak ada data anime</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="anime-list">
            ${animeData.map(anime => `
                <div class="anime-card anime-list-item" onclick="goToDetail('${anime.slug}', 'v2')">
                    <div class="anime-thumb">
                        <img src="${anime.poster}" alt="${anime.title}" loading="lazy" class="anime-poster">
                        <div class="anime-overlay">
                            <div class="anime-type">${anime.type || 'N/A'}</div>
                            ${anime.rating ? `<div class="anime-rating">⭐ ${anime.rating}</div>` : ''}
                        </div>
                    </div>
                    <div class="anime-info">
                        <div class="anime-title" title="${anime.title}">${anime.title}</div>
                        <div class="anime-meta">${anime.status || 'Unknown'}</div>
                        ${anime.genres && anime.genres.length > 0 ? `
                            <div class="anime-genres">
                                ${anime.genres.slice(0, 3).map(g => `<span class="genre-tag">${g.name}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function goToDetail(slug, version) {
    if (slug) {
        const detailPage = version === 'v2' ? `/detail-v2/${slug}` : `/detail/${slug}`;
        window.location.href = detailPage;
    }
}

async function loadAllAnimePage(page = 1) {
    currentPage = page;
    
    const container = document.getElementById('allAnimeContainer');
    container.innerHTML = '<div class="loading">Memuat daftar anime...</div>';
    
    // Update page title and description
    const pageTitle = document.getElementById('pageTitle');
    const pageDescription = document.getElementById('pageDescription');
    
    if (currentServer === 'v2') {
        pageTitle.textContent = 'Daftar Anime (Samehadaku)';
        pageDescription.textContent = 'Semua anime dengan filter';
        
        // Show filters for V2
        const filters = document.getElementById('animeFilters');
        if (filters) filters.style.display = 'block';
        
        // Get current filters including genres
        const selectedGenres = getSelectedGenres();
        const currentFilters = {
            title: document.getElementById('filterTitle')?.value || '',
            status: document.getElementById('filterStatus')?.value || '',
            type: document.getElementById('filterType')?.value || '',
            order: document.getElementById('filterOrder')?.value || 'title',
            genre: selectedGenres
        };
        
        const data = await fetchAllAnimeV2(currentFilters, page);
        
        if (data && data.data && data.data.animeData) {
            displayAllAnimeV2(data.data.animeData);
            
            // Handle pagination
            if (data.data.pagination) {
                paginationData = data.data.pagination;
                updatePaginationControls();
            }
        } else {
            container.innerHTML = '<div class="error">Gagal memuat daftar anime</div>';
        }
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        pageTitle.textContent = 'Daftar Lengkap Anime (Otakudesu)';
        pageDescription.textContent = 'Semua anime A-Z';
        
        // Hide filters for V1
        const filters = document.getElementById('animeFilters');
        if (filters) filters.style.display = 'none';
        
        const data = await fetchAllAnimeV1();
        
        if (data && data.data) {
            createAlphabetNav(data.data);
            displayAllAnimeV1(data.data);
        } else {
            container.innerHTML = '<div class="error">Gagal memuat daftar anime</div>';
            
            const alphabetNav = document.getElementById('alphabetNav');
            if (alphabetNav) alphabetNav.innerHTML = '';
        }
    }
}

// Pagination functions
function updatePaginationControls() {
    const paginationContainer = document.getElementById('paginationContainer');
    const paginationInfo = document.getElementById('paginationInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (!paginationData || currentServer !== 'v2') {
        if (paginationContainer) paginationContainer.style.display = 'none';
        return;
    }
    
    // Show pagination
    if (paginationContainer) paginationContainer.style.display = 'block';
    
    // Update info text
    if (paginationInfo) {
        paginationInfo.textContent = `Page ${paginationData.current_page} of ${paginationData.total_pages}`;
    }
    
    // Update button states
    if (prevBtn) {
        prevBtn.disabled = !paginationData.has_previous_page;
        prevBtn.style.opacity = paginationData.has_previous_page ? '1' : '0.5';
        prevBtn.style.cursor = paginationData.has_previous_page ? 'pointer' : 'not-allowed';
    }
    
    if (nextBtn) {
        nextBtn.disabled = !paginationData.has_next_page;
        nextBtn.style.opacity = paginationData.has_next_page ? '1' : '0.5';
        nextBtn.style.cursor = paginationData.has_next_page ? 'pointer' : 'not-allowed';
    }
}

function goToNextPage() {
    if (paginationData && paginationData.has_next_page) {
        loadAllAnimePage(paginationData.next_page);
    }
}

function goToPreviousPage() {
    if (paginationData && paginationData.has_previous_page) {
        loadAllAnimePage(paginationData.previous_page);
    }
}

// Filter functions for V2
function applyFilters() {
    if (currentServer === 'v2') {
        currentPage = 1; // Reset to first page when applying filters
        loadAllAnimePage(1);
    }
}

function resetFilters() {
    if (currentServer === 'v2') {
        document.getElementById('filterTitle').value = '';
        document.getElementById('filterStatus').value = '';
        document.getElementById('filterType').value = '';
        document.getElementById('filterOrder').value = 'title';
        
        // Uncheck all genre checkboxes
        const genreCheckboxes = document.querySelectorAll('input[name="genre"]');
        genreCheckboxes.forEach(cb => cb.checked = false);
        
        // Update genre button text
        updateGenreButtonText();
        
        currentPage = 1;
        loadAllAnimePage(1);
    }
}

// Genre filter functions
function toggleGenrePanel() {
    const panel = document.getElementById('genrePanel');
    const btn = document.getElementById('genreToggleBtn');
    
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        btn.innerHTML = 'Pilih Genre ▲';
    } else {
        panel.style.display = 'none';
        btn.innerHTML = 'Pilih Genre ▼';
    }
}

function getSelectedGenres() {
    const checkboxes = document.querySelectorAll('input[name="genre"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function updateGenreButtonText() {
    const selected = getSelectedGenres();
    const btn = document.getElementById('genreToggleBtn');
    
    if (selected.length === 0) {
        btn.innerHTML = 'Pilih Genre ▼';
    } else {
        const isOpen = document.getElementById('genrePanel').style.display === 'block';
        const arrow = isOpen ? '▲' : '▼';
        btn.innerHTML = `Genre (${selected.length} dipilih) ${arrow}`;
    }
}

// Add event listener to genre checkboxes to update button text
document.addEventListener('DOMContentLoaded', () => {
    // ... existing code ...
    
    // Add listeners to genre checkboxes
    setTimeout(() => {
        const genreCheckboxes = document.querySelectorAll('input[name="genre"]');
        genreCheckboxes.forEach(cb => {
            cb.addEventListener('change', updateGenreButtonText);
        });
    }, 100);
});

// Smooth scroll to section (for V1)
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('alphabet-btn')) {
        e.preventDefault();
        const targetId = e.target.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
            const offset = 100;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    }
});
