// Server configuration
let currentServer = localStorage.getItem('selectedServer') || 'v1';

const pathname = window.location.pathname;
if (pathname.startsWith('/v6')) {
    currentServer = 'v6';
} else if (pathname.startsWith('/v5')) {
    currentServer = 'v5';
} else if (pathname.startsWith('/v4')) {
    currentServer = 'v4';
} else if (pathname.startsWith('/v3')) {
    currentServer = 'v3';
} else if (pathname.startsWith('/v2')) {
    currentServer = 'v2';
} else if (pathname.startsWith('/v1')) {
    currentServer = 'v1';
}

localStorage.setItem('selectedServer', currentServer);

const SERVER_API_MAP = {
    v1: '/api',
    v2: '/api/v2',
    v3: '/api/v3/kuramanime',
    v4: '/api/v4/anichin',
    v5: '/api/v5/anoboy',
    v6: '/api/v6/animeindo',
    v7: '/api/v7/nekopoi'
};

let API_BASE = SERVER_API_MAP[currentServer] || '/api';

let homeData = null;

function getHomePath(server) {
    if (server === 'v7') return '/v7/home';
    if (server === 'v6') return '/v6/home';
    if (server === 'v5') return '/v5/home';
    if (server === 'v4') return '/v4/home';
    if (server === 'v3') return '/v3/home';
    if (server === 'v2') return '/v2/home';
    return '/v1/home';
}

// Initialize server selector on page load
document.addEventListener('DOMContentLoaded', () => {
    const serverSelect = document.getElementById('serverSelect');
    if (serverSelect) {
        serverSelect.value = currentServer;
        serverSelect.addEventListener('change', (e) => {
            changeServer(e.target.value);
        });
    }
    
    // Apply server class to body on load
    applyServerClass(currentServer);
    initSidebarToggle();

    document.querySelectorAll('[data-home-nav]').forEach((element) => {
        element.addEventListener('click', () => {
            const targetPath = getHomePath(currentServer);
            if (window.location.pathname !== targetPath) {
                window.location.href = targetPath;
            } else {
                document.body.classList.remove('sidebar-open');
            }
        });
    });
});

function applyServerClass(server) {
    // Remove all server classes
    document.body.classList.remove('server-v1', 'server-v2', 'server-v3', 'server-v4', 'server-v5', 'server-v6', 'server-v7');

    // Add current server class
    const allowedServers = new Set(['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7']);
    const targetClass = allowedServers.has(server) ? `server-${server}` : 'server-v1';
    document.body.classList.add(targetClass);
}

function changeServer(server) {
    currentServer = server;
    localStorage.setItem('selectedServer', server);

    const targetPath = getHomePath(server);

    if (window.location.pathname !== targetPath) {
        window.location.href = targetPath;
        return;
    }

    API_BASE = SERVER_API_MAP[server] || '/api';
    applyServerClass(server);
    showServerNotification(server);
    loadHomePage();
}

function showServerNotification(server) {
    const SERVER_NAME_MAP = {
        v1: 'Otakudesu',
        v2: 'Samehadaku',
        v3: 'Kuramanime',
        v4: 'Anichin',
        v5: 'Anoboy',
        v6: 'AnimeIndo',
        v7: 'Nekopoi'
    };
    const serverName = SERVER_NAME_MAP[server] || 'Otakudesu';
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'server-notification';
    notification.textContent = `Server beralih ke ${serverName}`;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background-color: #e50914;
        color: white;
        padding: 15px 25px;
        border-radius: 5px;
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    const topbar = document.querySelector('.topbar');
    const shouldAdd = window.scrollY > 100;

    if (navbar) {
        navbar.classList.toggle('scrolled', shouldAdd);
    }

    if (topbar) {
        topbar.classList.toggle('scrolled', shouldAdd);
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
    const data = await fetchAPI('/home');
    if (!data || !data.data) {
        showError('ongoingAnime');
        showError('completedAnime');
        return;
    }
    
    homeData = data;
    
    // Check if using V1 (Otakudesu) or V2 (Samehadaku) format
    const isV2 = data.data.recent_anime !== undefined;
    
    if (isV2) {
        // V2 format - Samehadaku (top10_weekly + project_movie + recent_anime)
        const top10 = data.data.top10_weekly || [];
        const projectMovie = data.data.project_movie || [];
        const recentAnime = data.data.recent_anime || [];
        
        // Update section titles for V2
        document.getElementById('ongoingTitle').textContent = 'Top 10 Minggu Ini';
        document.getElementById('completedTitle').textContent = 'Anime Terbaru';
        
        // Show Project Movie section for V2
        const projectMovieSection = document.getElementById('projectMovieSection');
        if (projectMovieSection) {
            projectMovieSection.style.display = 'block';
        }
        
        // Display featured anime from top 10 or recent
        if (top10.length > 0) {
            displayFeaturedAnime(top10[0]);
        } else if (recentAnime.length > 0) {
            displayFeaturedAnime(recentAnime[0]);
        }
        
        // Display Top 10 in first section
        if (top10.length > 0) {
            displayAnimeList('ongoingAnime', top10, 'top10');
        } else {
            showError('ongoingAnime');
        }
        
        // Display Recent Anime in second section
        if (recentAnime.length > 0) {
            displayAnimeList('completedAnime', recentAnime.slice(0, 8), 'recent');
        } else {
            showError('completedAnime');
        }
        
        // Display Project Movie in third section
        if (projectMovie.length > 0) {
            displayAnimeList('projectMovie', projectMovie, 'movie');
        } else {
            showError('projectMovie');
        }
    } else {
        // V1 format - Otakudesu (ongoing_anime & complete_anime)
        
        // Hide Project Movie section for V1
        const projectMovieSection = document.getElementById('projectMovieSection');
        if (projectMovieSection) {
            projectMovieSection.style.display = 'none';
        }
        
        // Update section titles for V1
        document.getElementById('ongoingTitle').textContent = 'Anime Ongoing';
        document.getElementById('completedTitle').textContent = 'Anime Tamat';
        
        // Display featured anime from ongoing
        if (data.data.ongoing_anime && data.data.ongoing_anime.length > 0) {
            displayFeaturedAnime(data.data.ongoing_anime[0]);
        }
        
        // Display ongoing anime list
        if (data.data.ongoing_anime && data.data.ongoing_anime.length > 0) {
            displayAnimeList('ongoingAnime', data.data.ongoing_anime, 'ongoing');
        } else {
            showError('ongoingAnime');
        }
        
        // Display completed anime list
        if (data.data.complete_anime && data.data.complete_anime.length > 0) {
            displayAnimeList('completedAnime', data.data.complete_anime, 'completed');
        } else {
            showError('completedAnime');
        }
    }
}

function displayFeaturedAnime(anime) {
    const heroSection = document.getElementById('heroSection');
    const heroTitle = document.getElementById('heroTitle');
    const heroDescription = document.getElementById('heroDescription');
    const heroPlayBtn = document.getElementById('heroPlayBtn');
    const heroInfoBtn = document.getElementById('heroInfoBtn');
    
    if (anime.poster) {
        heroSection.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${anime.poster})`;
    }
    
    heroTitle.textContent = anime.title || 'Anime Unggulan';
    
    // Create description from available data
    let description = 'Tonton anime terbaru dan terpopuler di AnimMe';
    if (anime.synopsis) {
        description = anime.synopsis;
    } else if (anime.current_episode || anime.release_day) {
        description = `${anime.current_episode || ''} ${anime.release_day ? '• Rilis setiap ' + anime.release_day : ''}`;
    }
    heroDescription.textContent = description;
    
    heroPlayBtn.onclick = () => {
        if (anime.slug) {
            goToDetail(anime.slug);
        }
    };
    
    heroInfoBtn.onclick = () => {
        if (anime.slug) {
            goToDetail(anime.slug);
        }
    };
}

function displayAnimeList(containerId, animeList, type = 'ongoing') {
    const container = document.getElementById(containerId);
    
    if (!animeList || animeList.length === 0) {
        container.innerHTML = '<div class="error">Tidak ada data anime</div>';
        return;
    }
    
    container.innerHTML = animeList.map(anime => {
        // Determine episode info based on type and available fields
        let episodeInfo = '';
        
        // Check if V2 format (has release_date instead of release_day)
        const isV2Format = anime.release_date !== undefined;
        
        if (isV2Format) {
            // V2 Samehadaku format
            if (type === 'top10' && anime.rating) {
                // Top 10 format - show rank and rating
                episodeInfo = anime.rating ? `⭐ ${anime.rating}` : 'No Rating';
                if (anime.rank) {
                    episodeInfo = `#${anime.rank} • ${episodeInfo}`;
                }
            } else if (type === 'movie' && anime.genres) {
                const releaseInfo = anime.release_date ? `🎬 ${anime.release_date}` : 'Movie';
                const genresInfo = anime.genres.length > 0 ? anime.genres.slice(0, 2).join(', ') : '';
                episodeInfo = genresInfo ? `${releaseInfo} • ${genresInfo}` : releaseInfo;
            } else {
                // Recent anime format
                episodeInfo = `Ep ${anime.current_episode || 'N/A'}`;
                if (anime.release_date) {
                    episodeInfo += ` • ${anime.release_date}`;
                }
            }
        } else {
            // V1 Otakudesu format
            if (type === 'ongoing') {
                episodeInfo = anime.current_episode || 'Episode N/A';
                if (anime.release_day) {
                    episodeInfo += ` • ${anime.release_day}`;
                }
            } else if (type === 'completed') {
                episodeInfo = `${anime.episode_count || 'N/A'} Episode`;
                if (anime.rating) {
                    episodeInfo += ` • ⭐ ${anime.rating}`;
                }
            } else {
                episodeInfo = anime.current_episode || anime.episode_count || 'Episode N/A';
            }
        }
        
        const isTop10 = type === 'top10';
        const cardClass = isTop10 ? 'anime-card top-ten-card' : 'anime-card';
        const rankBadge = isTop10 && anime.rank ? `<div class="rank-badge">#${anime.rank}</div>` : '';
        const ratingBadge = isTop10 && anime.rating ? `<div class="rating-badge">⭐ ${anime.rating}</div>` : '';

        // For V1 ongoing anime with episode_slug, go directly to episode player
        // For V2 recent anime, go directly to episode player
        // Only go to episode if episode_slug exists and is valid
        const isV1OngoingAnime = currentServer === 'v1' && type === 'ongoing' && anime.episode_slug && anime.episode_slug !== anime.slug;
        const isV2RecentAnime = currentServer === 'v2' && type === 'recent';
        const shouldGoToEpisode = isV1OngoingAnime || isV2RecentAnime;
        const targetSlug = isV1OngoingAnime ? anime.episode_slug : anime.slug;
        const onclickAction = shouldGoToEpisode ? `goToEpisode('${targetSlug}')` : `goToDetail('${anime.slug}')`;

        return `
            <div class="${cardClass}" onclick="${onclickAction}">
                <div class="anime-thumb">
                    ${rankBadge}
                    ${ratingBadge}
                    <img src="${anime.poster || 'https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image'}" 
                         alt="${anime.title}" 
                         class="anime-poster"
                         onerror="this.src='https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image'}">
                </div>
                <div class="anime-info">
                    <div class="anime-title" title="${anime.title}">${anime.title}</div>
                    <div class="anime-meta">${episodeInfo}</div>
                </div>
            </div>
        `;
    }).join('');
}

function goToDetail(slug) {
    if (slug) {
        const detailPath = currentServer === 'v2' ? '/detail-v2' : '/detail';
        window.location.href = `${detailPath}/${slug}`;
    }
}

function goToEpisode(slug) {
    if (slug) {
        const playerPath = currentServer === 'v2' ? '/player-v2' : '/player';
        window.location.href = `${playerPath}/${slug}`;
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
    
    // Redirect to search page with clean URL
    window.location.href = `/search/${encodeURIComponent(keyword)}`;
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
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchContainer.classList.contains('active')) {
            searchContainer.classList.remove('active');
        }
    });
}

function initSidebarToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const menuCloseBtn = document.getElementById('menuCloseBtn');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    const sidebarLinks = document.querySelectorAll('.sidebar-menu .nav-link');
    const body = document.body;

    const openSidebar = () => body.classList.add('sidebar-open');
    const closeSidebar = () => body.classList.remove('sidebar-open');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            if (body.classList.contains('sidebar-open')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
    }

    if (menuCloseBtn) {
        menuCloseBtn.addEventListener('click', closeSidebar);
    }

    if (sidebarBackdrop) {
        sidebarBackdrop.addEventListener('click', closeSidebar);
    }

    sidebarLinks.forEach((link) => link.addEventListener('click', closeSidebar));

    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            closeSidebar();
        }
    });

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeSidebar();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadHomePage();
    initMobileSearch();
});
