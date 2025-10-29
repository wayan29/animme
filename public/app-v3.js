// V3 Kuramanime Configuration
const API_BASE = '/api/v3/kuramanime';
let homeData = null;
let currentCarouselIndex = 0;
let carouselInterval = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const serverSelect = document.getElementById('serverSelect');
    if (serverSelect) {
        serverSelect.value = 'v3';
        serverSelect.addEventListener('change', (e) => {
            changeServer(e.target.value);
        });
    }
    
    loadHomePage();
    initMobileSearch();
});

function changeServer(server) {
    localStorage.setItem('selectedServer', server);
    
    // Navigate to appropriate page
    if (server === 'v3') {
        window.location.href = '/v3';
    } else if (server === 'v2') {
        window.location.href = '/';
    } else {
        window.location.href = '/';
    }
}

// Navbar scroll effect
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
    console.log('[V3] Loading homepage...');
    const data = await fetchAPI('/home');
    console.log('[V3] Data received:', data);
    
    if (!data) {
        console.error('[V3] No data received from API');
        showError('carouselContainer');
        showError('sedangTayang');
        showError('dilihatTerbanyak');
        return;
    }
    
    if (!data.data) {
        console.error('[V3] Data object is missing');
        showError('carouselContainer');
        showError('sedangTayang');
        showError('dilihatTerbanyak');
        return;
    }
    
    homeData = data.data;
    
    // Display banner recommendations carousel
    if (homeData.banner_rekomendasi && homeData.banner_rekomendasi.length > 0) {
        displayCarousel(homeData.banner_rekomendasi);
    }
    
    // Display sedang tayang (currently airing)
    if (homeData.sedang_tayang && homeData.sedang_tayang.length > 0) {
        displayAnimeGrid('sedangTayang', homeData.sedang_tayang, 'ongoing');
    } else {
        showError('sedangTayang');
    }
    
    // Display dilihat terbanyak musim ini (most viewed this season)
    if (homeData.dilihat_terbanyak_musim_ini && homeData.dilihat_terbanyak_musim_ini.length > 0) {
        displayAnimeGrid('dilihatTerbanyak', homeData.dilihat_terbanyak_musim_ini, 'popular');
    } else {
        showError('dilihatTerbanyak');
    }
    
    // Display komentar terbaru episode (latest episode comments)
    if (homeData.komentar_terbaru_episode && homeData.komentar_terbaru_episode.length > 0) {
        displayComments('komentarEpisode', homeData.komentar_terbaru_episode);
    } else {
        showError('komentarEpisode');
    }
    
    // Display selesai tayang (finished airing)
    if (homeData.selesai_tayang && homeData.selesai_tayang.length > 0) {
        displayAnimeGrid('selesaiTayang', homeData.selesai_tayang, 'completed');
    } else {
        showError('selesaiTayang');
    }
    
    // Display film layar lebar (movies)
    if (homeData.film_layar_lebar && homeData.film_layar_lebar.length > 0) {
        displayAnimeGrid('filmLayarLebar', homeData.film_layar_lebar, 'movie');
    } else {
        showError('filmLayarLebar');
    }
    
    // Display komentar terbaru anime (latest anime comments)
    if (homeData.komentar_terbaru_anime && homeData.komentar_terbaru_anime.length > 0) {
        displayComments('komentarAnime', homeData.komentar_terbaru_anime);
    } else {
        showError('komentarAnime');
    }
}

function displayCarousel(banners) {
    const container = document.getElementById('carouselContainer');
    const indicators = document.getElementById('carouselIndicators');
    
    if (!banners || banners.length === 0) {
        container.innerHTML = '<div class="error">Tidak ada banner rekomendasi</div>';
        return;
    }
    
    container.innerHTML = banners.map((anime, index) => {
        const posterUrl = anime.poster || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1920" height="600"%3E%3Crect fill="%230f0f0f" width="1920" height="600"/%3E%3Ctext fill="%23e50914" font-size="48" font-family="Arial" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Banner%3C/text%3E%3C/svg%3E';
        const genres = anime.genres && anime.genres.length > 0 ? anime.genres.join(', ') : '';
        
        return `
            <div class="carousel-slide ${index === 0 ? 'active' : ''}" style="background-image: linear-gradient(to right, rgba(0,0,0,0.8) 30%, transparent), url(${posterUrl})">
                <div class="carousel-content">
                    <h2 class="carousel-title">${anime.title}</h2>
                    <div class="carousel-genres">${genres}</div>
                    <p class="carousel-description">${anime.description || ''}</p>
                    <div class="carousel-buttons">
                        <button class="btn btn-primary" onclick="goToDetail('${anime.slug}', '${anime.anime_id}')">
                            ▶ Tonton Sekarang
                        </button>
                        <button class="btn btn-secondary" onclick="goToDetail('${anime.slug}', '${anime.anime_id}')">
                            ℹ Info Lebih
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Create indicators
    indicators.innerHTML = banners.map((_, index) => 
        `<button class="indicator ${index === 0 ? 'active' : ''}" onclick="goToSlide(${index})"></button>`
    ).join('');
    
    // Setup carousel controls
    document.getElementById('carouselPrev').onclick = () => navigateCarousel(-1);
    document.getElementById('carouselNext').onclick = () => navigateCarousel(1);
    
    // Auto-play carousel
    startCarouselAutoPlay(banners.length);
}

function navigateCarousel(direction) {
    const slides = document.querySelectorAll('.carousel-slide');
    const indicators = document.querySelectorAll('.indicator');
    
    if (slides.length === 0) return;
    
    slides[currentCarouselIndex].classList.remove('active');
    indicators[currentCarouselIndex].classList.remove('active');
    
    currentCarouselIndex = (currentCarouselIndex + direction + slides.length) % slides.length;
    
    slides[currentCarouselIndex].classList.add('active');
    indicators[currentCarouselIndex].classList.add('active');
    
    // Reset auto-play timer
    stopCarouselAutoPlay();
    startCarouselAutoPlay(slides.length);
}

function goToSlide(index) {
    const slides = document.querySelectorAll('.carousel-slide');
    const indicators = document.querySelectorAll('.indicator');
    
    if (slides.length === 0) return;
    
    slides[currentCarouselIndex].classList.remove('active');
    indicators[currentCarouselIndex].classList.remove('active');
    
    currentCarouselIndex = index;
    
    slides[currentCarouselIndex].classList.add('active');
    indicators[currentCarouselIndex].classList.add('active');
    
    // Reset auto-play timer
    stopCarouselAutoPlay();
    startCarouselAutoPlay(slides.length);
}

function startCarouselAutoPlay(slideCount) {
    if (slideCount <= 1) return;
    
    carouselInterval = setInterval(() => {
        navigateCarousel(1);
    }, 5000);
}

function stopCarouselAutoPlay() {
    if (carouselInterval) {
        clearInterval(carouselInterval);
        carouselInterval = null;
    }
}

function displayAnimeGrid(containerId, animeList, type = 'ongoing') {
    const container = document.getElementById(containerId);
    
    if (!animeList || animeList.length === 0) {
        container.innerHTML = '<div class="error">Tidak ada data anime</div>';
        return;
    }
    
    container.innerHTML = animeList.map(anime => {
        const posterUrl = anime.poster || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect fill="%230f0f0f" width="200" height="300"/%3E%3Ctext fill="%23e50914" font-size="20" font-family="Arial" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
        
        let episodeInfo = '';
        let cardClass = 'anime-card';
        let extraBadge = '';
        
        if (type === 'ongoing') {
            episodeInfo = anime.episode || 'Episode N/A';
            if (anime.type) {
                episodeInfo += ` • ${anime.type}`;
            }
        } else if (type === 'popular') {
            episodeInfo = anime.rating ? `⭐ ${anime.rating}` : 'No Rating';
        } else if (type === 'completed' || type === 'movie') {
            episodeInfo = anime.episode || '';
            if (anime.type) {
                episodeInfo = anime.type;
            }
        }
        
        return `
            <div class="${cardClass}" onclick="goToDetail('${anime.slug}', '${anime.anime_id || ''}')">
                <div class="anime-thumb">
                    ${extraBadge}
                    <img src="${posterUrl}" 
                         alt="${anime.title}" 
                         class="anime-poster"
                         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22300%22%3E%3Crect fill=%22%230f0f0f%22 width=%22200%22 height=%22300%22/%3E%3Ctext fill=%22%23e50914%22 font-size=%2220%22 font-family=%22Arial%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3ENo Image%3C/text%3E%3C/svg%3E'">
                </div>
                <div class="anime-info">
                    <div class="anime-title" title="${anime.title}">${anime.title}</div>
                    <div class="anime-meta">${episodeInfo}</div>
                </div>
            </div>
        `;
    }).join('');
}

function displayComments(containerId, comments) {
    const container = document.getElementById(containerId);
    
    if (!comments || comments.length === 0) {
        container.innerHTML = '<div class="error">Tidak ada komentar</div>';
        return;
    }
    
    container.innerHTML = comments.map(comment => {
        const posterUrl = comment.poster || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="150"%3E%3Crect fill="%230f0f0f" width="100" height="150"/%3E%3Ctext fill="%23e50914" font-size="12" font-family="Arial" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
        
        return `
            <div class="comment-item" onclick="window.open('${comment.url}', '_blank')">
                <div class="comment-poster">
                    <img src="${posterUrl}" 
                         alt="${comment.title}" 
                         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22150%22%3E%3Crect fill=%22%230f0f0f%22 width=%22100%22 height=%22150%22/%3E%3Ctext fill=%22%23e50914%22 font-size=%2212%22 font-family=%22Arial%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3ENo Image%3C/text%3E%3C/svg%3E'">
                </div>
                <div class="comment-info">
                    <div class="comment-anime-title">${comment.title}</div>
                    <div class="comment-episode">${comment.episode_info || ''}</div>
                    <div class="comment-meta">
                        <span class="comment-username">👤 ${comment.username}</span>
                        ${comment.time_ago ? `<span class="comment-time">🕐 ${comment.time_ago}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function goToDetail(slug, animeId) {
    if (slug && animeId) {
        window.location.href = `/v3/${animeId}/${slug}`;
    } else if (slug) {
        // Fallback if only slug is available
        window.location.href = `/detail-v3/${slug}`;
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
    
    window.location.href = `/search-v3?q=${encodeURIComponent(keyword)}`;
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
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchContainer.classList.contains('active')) {
            searchContainer.classList.remove('active');
        }
    });
}
