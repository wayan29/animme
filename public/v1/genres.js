const API_BASE = '/api';

async function fetchGenres() {
    try {
        const response = await fetch(`${API_BASE}/genres`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching genres:', error);
        return null;
    }
}

function displayGenres(genres) {
    const container = document.getElementById('genreContainer');
    
    if (!genres || genres.length === 0) {
        container.innerHTML = '<div class="error">Tidak ada data genre</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="genre-grid">
            ${genres.map(genre => `
                <div class="genre-card" onclick="goToGenre('${genre.slug}', '${genre.name}')">
                    <div class="genre-card-content">
                        <h3 class="genre-card-title">${genre.name}</h3>
                        <span class="genre-card-arrow">→</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function goToGenre(slug, name) {
    if (slug) {
        // Use clean URL with optional name parameter
        window.location.href = `/genre/${slug}?name=${encodeURIComponent(name)}`;
    }
}

async function loadGenresPage() {
    const data = await fetchGenres();
    
    if (data && data.data) {
        displayGenres(data.data);
    } else {
        const container = document.getElementById('genreContainer');
        container.innerHTML = '<div class="error">Gagal memuat daftar genre</div>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadGenresPage();
});
