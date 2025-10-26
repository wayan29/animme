const API_BASE = '/api';

async function fetchSearchResults(keyword) {
    try {
        const response = await fetch(`${API_BASE}/search/${encodeURIComponent(keyword)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching search results:', error);
        return null;
    }
}

function extractSlugFromUrl(url) {
    // If it's already a slug (not a URL), return it
    if (!url) return '';
    if (!url.startsWith('http')) return url;
    
    // Extract slug from URL like "https://otakudesu.best/anime/borot-sub-indo"
    const match = url.match(/\/anime\/([^\/]+)/);
    return match ? match[1] : url;
}

function displaySearchResults(results, keyword) {
    const container = document.getElementById('searchResultsContainer');
    const searchInfo = document.getElementById('searchInfo');
    
    if (!results || results.length === 0) {
        searchInfo.textContent = `Tidak ditemukan hasil untuk "${keyword}"`;
        searchInfo.style.color = '#999';
        container.innerHTML = '<div class="no-results">Tidak ada anime yang ditemukan. Coba kata kunci lain.</div>';
        return;
    }
    
    searchInfo.textContent = `Ditemukan ${results.length} hasil untuk "${keyword}"`;
    searchInfo.style.color = '#e50914';
    
    container.innerHTML = results.map(anime => {
        const slug = extractSlugFromUrl(anime.slug);
        const genresList = anime.genres && anime.genres.length > 0 
            ? anime.genres.map(g => g.name).slice(0, 5).join(', ')
            : 'N/A';
        
        return `
            <div class="search-result-item" onclick="goToDetail('${slug}')">
                <div class="search-result-poster">
                    <img src="${anime.poster || 'https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image'}" 
                         alt="${anime.title}"
                         onerror="this.src='https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image'">
                </div>
                <div class="search-result-info">
                    <h3 class="search-result-title">${anime.title}</h3>
                    ${anime.japanese_title ? `<p class="search-result-jp-title">${anime.japanese_title}</p>` : ''}
                    
                    <div class="search-result-meta">
                        ${anime.rating ? `<span class="meta-badge">⭐ ${anime.rating}</span>` : ''}
                        ${anime.type ? `<span class="meta-badge">📺 ${anime.type}</span>` : ''}
                        ${anime.status ? `<span class="meta-badge status-${anime.status.toLowerCase()}">${anime.status}</span>` : ''}
                        ${anime.episode_count ? `<span class="meta-badge">📼 ${anime.episode_count} Eps</span>` : ''}
                    </div>
                    
                    ${anime.studio ? `<p class="search-result-studio">Studio: ${anime.studio}</p>` : ''}
                    ${anime.release_date ? `<p class="search-result-date">Rilis: ${anime.release_date}</p>` : ''}
                    
                    <div class="search-result-genres">
                        <strong>Genre:</strong> ${genresList}
                    </div>
                    
                    ${anime.synopsis ? `
                        <p class="search-result-synopsis">
                            ${anime.synopsis.length > 300 ? anime.synopsis.substring(0, 300) + '...' : anime.synopsis}
                        </p>
                    ` : ''}
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

async function performSearch() {
    const keyword = document.getElementById('searchKeyword').value.trim();
    
    if (!keyword) {
        alert('Masukkan kata kunci pencarian!');
        return;
    }
    
    // Update URL without reload
    const newUrl = `${window.location.pathname}?q=${encodeURIComponent(keyword)}`;
    window.history.pushState({}, '', newUrl);
    
    const container = document.getElementById('searchResultsContainer');
    const searchInfo = document.getElementById('searchInfo');
    
    searchInfo.textContent = 'Mencari...';
    searchInfo.style.color = '#999';
    container.innerHTML = '<div class="loading">Mencari anime...</div>';
    
    const data = await fetchSearchResults(keyword);
    
    console.log('Search API response:', data);
    
    // API returns { status, data: [...] } not { search_results: [...] }
    if (data && data.data && Array.isArray(data.data)) {
        displaySearchResults(data.data, keyword);
    } else if (data && data.search_results) {
        // Fallback for old API structure
        displaySearchResults(data.search_results, keyword);
    } else {
        console.error('Invalid API response:', data);
        searchInfo.textContent = 'Gagal melakukan pencarian';
        searchInfo.style.color = '#e50914';
        container.innerHTML = '<div class="error">Gagal melakukan pencarian. Coba lagi.</div>';
    }
}



// Enter key to search
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchKeyword');
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // Support both clean URL (/search/keyword) and query (?q=keyword)
    const pathParts = window.location.pathname.split('/');
    let keyword = pathParts[2] ? decodeURIComponent(pathParts[2]) : null; // /search/:keyword
    
    if (!keyword) {
        const urlParams = new URLSearchParams(window.location.search);
        keyword = urlParams.get('q');
    }
    
    if (keyword) {
        document.getElementById('searchKeyword').value = keyword;
        performSearch();
    }
});
