const API_BASE = '/api';

async function fetchAllAnime() {
    try {
        const response = await fetch(`${API_BASE}/all-anime`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching all anime:', error);
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

function displayAllAnime(animeData) {
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
                        <div class="anime-list-item" onclick="goToDetail('${anime.slug}')">
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

function goToDetail(animeId) {
    if (animeId) {
        window.location.href = `/detail/${animeId}`;
    }
}

async function loadAllAnimePage() {
    const data = await fetchAllAnime();
    
    if (data && data.data) {
        createAlphabetNav(data.data);
        displayAllAnime(data.data);
    } else {
        const container = document.getElementById('allAnimeContainer');
        container.innerHTML = '<div class="error">Gagal memuat daftar anime</div>';
        
        const alphabetNav = document.getElementById('alphabetNav');
        alphabetNav.innerHTML = '';
    }
}

// Smooth scroll to section
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('alphabet-btn')) {
        e.preventDefault();
        const targetId = e.target.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
            const offset = 100; // offset for navbar
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    loadAllAnimePage();
});
