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
    if (server === 'v4') {
        window.location.href = '/v4/home';
    } else if (server === 'v3') {
        window.location.href = '/v3/home';
    } else if (server === 'v2') {
        window.location.href = '/v2/home';
    } else {
        window.location.href = '/v1/home';
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

    // Load dynamic sections for ongoing, finished, and movies
    await Promise.all([
        loadSectionFromEndpoint(
            'sedangTayang',
            '/ongoing?page=1&order_by=updated',
            'ongoing',
            homeData.sedang_tayang || [],
            12
        ),
        loadSectionFromEndpoint(
            'selesaiTayang',
            '/finished?page=1&order_by=updated',
            'completed',
            homeData.selesai_tayang || [],
            12
        ),
        loadSectionFromEndpoint(
            'filmLayarLebar',
            '/movie?page=1&order_by=updated',
            'movie',
            homeData.film_layar_lebar || [],
            9
        )
    ]);

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

async function loadSectionFromEndpoint(containerId, endpoint, type, fallbackList = [], limit = 8) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const response = await fetchAPI(endpoint);
        let list = [];

        if (response && response.status === 'success' && response.data) {
            list = response.data.anime_list || response.data.results || response.data.animeData || [];
        }

        if (!Array.isArray(list) || list.length === 0) {
            if (fallbackList && fallbackList.length > 0) {
                displayHomeAnimeGrid(containerId, fallbackList, type, limit);
            } else {
                showError(containerId);
            }
            return;
        }

        displayHomeAnimeGrid(containerId, list, type, limit);
    } catch (error) {
        console.error(`[V3] Failed to load section ${type}:`, error);
        if (fallbackList && fallbackList.length > 0) {
            displayHomeAnimeGrid(containerId, fallbackList, type, limit);
        } else {
            showError(containerId);
        }
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

function displayHomeAnimeGrid(containerId, animeList, type = 'ongoing', limit = 8) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const cleanList = Array.isArray(animeList) ? animeList.filter(Boolean) : [];
    if (cleanList.length === 0) {
        showError(containerId);
        return;
    }

    container.classList.remove('anime-row');
    container.classList.add('home-anime-grid');

    const selected = cleanList.slice(0, limit);
    container.innerHTML = selected.map(anime => {
        const posterUrl = anime.poster || anime.poster_url || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect fill="%230f0f0f" width="200" height="300"/%3E%3Ctext fill="%23e50914" font-size="20" font-family="Arial" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
        const title = anime.title || 'Unknown Title';
        const slug = anime.slug || '';
        const animeId = anime.anime_id || anime.id || '';
        let meta = '';

        if (type === 'ongoing') {
            const episode = anime.current_episode || anime.episode || (anime.episode_text ? anime.episode_text.replace(/Ep\s*/i, '') : 'N/A');
            meta = episode ? `Ep ${episode}` : 'Episode N/A';
            if (anime.release_day) {
                meta += ` • ${anime.release_day}`;
            }
        } else if (type === 'completed') {
            if (anime.total_episodes) {
                meta = `${anime.total_episodes} Episode`;
            } else if (anime.episode_text) {
                meta = anime.episode_text;
            } else {
                meta = 'Selesai';
            }
        } else if (type === 'movie') {
            meta = anime.episode_text || anime.type || 'Movie';
        }

        return `
            <div class="home-anime-card" data-slug="${slug}" data-anime-id="${animeId}" onclick="goToDetail('${slug}', '${animeId}')">
                <div class="home-anime-thumb">
                    <img src="${posterUrl}" alt="${title}" class="home-anime-poster"
                         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22300%22%3E%3Crect fill=%22%230f0f0f%22 width=%22200%22 height=%22300%22/%3E%3Ctext fill=%22%23e50914%22 font-size=%2220%22 font-family=%22Arial%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3ENo Image%3C/text%3E%3C/svg%3E'">
                </div>
                <div class="home-anime-info">
                    <div class="home-anime-title" title="${title}">${title}</div>
                    <div class="home-anime-meta">${meta}</div>
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
        
        // Generate internal URL
        let internalUrl = '';
        if (comment.episode_num && comment.anime_id && comment.slug) {
            // Episode comment - redirect to episode page
            internalUrl = `/v3/episode?animeId=${comment.anime_id}&slug=${comment.slug}&episode=${comment.episode_num}`;
        } else if (comment.anime_id && comment.slug) {
            // Anime comment - redirect to detail page
            internalUrl = `/v3/detail?animeId=${comment.anime_id}&slug=${comment.slug}`;
        } else {
            // Fallback to external URL if internal data is missing
            internalUrl = comment.url;
        }
        
        return `
            <div class="comment-item" onclick="window.location.href='${internalUrl}'">
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
        window.location.href = `/v3/detail/${animeId}/${slug}`;
    } else if (slug) {
        // Fallback if only slug is available
        window.location.href = `/v3/detail?slug=${slug}`;
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
    
    window.location.href = `/v3/search?q=${encodeURIComponent(keyword)}`;
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
