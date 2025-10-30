const API_BASE = '/api';

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

function getSlugFromURL() {
    // Support both clean URL and query parameter
    const pathParts = window.location.pathname.split('/');
    
    // Clean URL: /detail/slug-name
    if (pathParts.length >= 3 && pathParts[1] === 'detail' && pathParts[2]) {
        return pathParts[2];
    }
    
    // Fallback to query parameter: /detail?slug=slug-name
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('slug');
}

async function fetchBatchDownload(batchSlug) {
    try {
        const data = await fetchAPI(`/batch/${batchSlug}`);
        return data;
    } catch (error) {
        console.error('Error fetching batch download:', error);
        return null;
    }
}

async function fetchRandomRecommendations(count = 6) {
    try {
        const firstPage = await fetchAPI('/complete-anime/1');
        if (!firstPage || !firstPage.data || !firstPage.data.completedAnimeData) {
            return [];
        }

        const pagination = firstPage.data.paginationData || {};
        const totalPages = Math.min(
            pagination.last_page || pagination.total_pages || pagination.last_visible_page || 1,
            64
        );

        const targetPage = totalPages > 1
            ? Math.floor(Math.random() * totalPages) + 1
            : 1;

        let pageData = firstPage;
        if (targetPage !== 1) {
            const fetched = await fetchAPI(`/complete-anime/${targetPage}`);
            if (fetched && fetched.data && fetched.data.completedAnimeData) {
                pageData = fetched;
            }
        }

        const list = (pageData.data && pageData.data.completedAnimeData) ? [...pageData.data.completedAnimeData] : [];
        const uniqueBySlug = new Map();
        list.forEach(item => {
            if (item && item.slug && !uniqueBySlug.has(item.slug)) {
                uniqueBySlug.set(item.slug, item);
            }
        });

        const candidates = Array.from(uniqueBySlug.values());
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        return candidates.slice(0, count);
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        return [];
    }
}

async function loadAnimeDetail() {
    const slug = getSlugFromURL();
    
    console.log('Current URL:', window.location.href);
    console.log('Pathname:', window.location.pathname);
    console.log('Extracted slug:', slug);
    
    if (!slug) {
        showError('Slug anime tidak ditemukan!');
        return;
    }
    
    console.log('Fetching anime data for slug:', slug);
    const data = await fetchAPI(`/anime/${slug}`);
    
    if (!data || !data.data) {
        showError('Detail anime tidak ditemukan!');
        return;
    }
    
    // Store anime data globally
    window.currentAnimeData = data.data;
    
    // Fetch batch data if available
    if (data.data.batch && data.data.batch.slug) {
        const batchData = await fetchAPI(`/batch/${data.data.batch.slug}`);
        window.currentBatchData = batchData ? batchData.data : null;
    }
    
    // Fetch recommendations
    const recommendations = await fetchRandomRecommendations(6);
    data.data.recommendations = recommendations;
    
    displayAnimeDetail(data.data, slug);
}

async function showBatchDownload(slug) {
    const batchContainer = document.getElementById('batchDownloadContainer');
    
    // Check if batch data already exists from initial anime detail API
    const anime = window.currentAnimeData;
    if (anime && anime.batch && anime.batch.slug) {
        const batchSlug = anime.batch.slug;
        batchContainer.innerHTML = '<div class="loading">Memuat link download batch...</div>';
        batchContainer.style.display = 'block';
        
        const batchData = await fetchBatchDownload(batchSlug);
        
        if (batchData && batchData.data && batchData.data.downloadUrl) {
            displayBatchDownload(batchData.data);
        } else {
            batchContainer.innerHTML = '<div class="error">Download batch tidak tersedia</div>';
        }
    } else {
        batchContainer.innerHTML = '<div class="error">Batch download tidak tersedia untuk anime ini</div>';
        batchContainer.style.display = 'block';
    }
}

function displayBatchDownload(batchData) {
    const container = document.getElementById('batchDownloadContainer');
    
    if (!batchData.downloadUrl || !batchData.downloadUrl.formats) {
        container.innerHTML = '<div class="error">Download batch tidak tersedia</div>';
        return;
    }
    
    let downloadHTML = '<div class="batch-download-content">';
    
    batchData.downloadUrl.formats.forEach(format => {
        downloadHTML += `<div class="batch-format-section">`;
        downloadHTML += `<h3 class="batch-format-title">${format.title}</h3>`;
        
        format.qualities.forEach(quality => {
            downloadHTML += `
                <div class="quality-section">
                    <div class="quality-header">
                        <span class="quality-title">${quality.title}</span>
                        <span class="quality-size">${quality.size}</span>
                    </div>
                    <div class="download-links">
                        ${quality.urls.map(url => `
                            <a href="${url.url}" target="_blank" rel="noopener noreferrer" class="download-link-btn">
                                📥 ${url.title}
                            </a>
                        `).join('')}
                    </div>
                </div>
            `;
        });
        
        downloadHTML += `</div>`;
    });
    
    downloadHTML += '</div>';
    
    container.innerHTML = downloadHTML;
    container.style.display = 'block';
}

function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    if (tabName === 'episodes') {
        document.getElementById('episodesTab').style.display = 'block';
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
    } else if (tabName === 'batch') {
        document.getElementById('batchTab').style.display = 'block';
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        
        // Load batch data if not already loaded
        if (!window.batchDataLoaded && window.currentBatchData) {
            displayBatchInTab(window.currentBatchData);
            window.batchDataLoaded = true;
        }
    }
}

function displayBatchInTab(batchData) {
    const container = document.getElementById('batchDownloadContainer');
    
    if (!batchData || !batchData.download_list || batchData.download_list.length === 0) {
        container.innerHTML = '<div class="error">Download batch tidak tersedia</div>';
        return;
    }
    
    let downloadHTML = `
        <div class="batch-info">
            <h3 style="color: #e50914; margin-bottom: 15px;">Download Lengkap - ${batchData.total_episodes} Episode</h3>
            <p style="color: #999; margin-bottom: 25px;">Unduh semua episode sekaligus dalam satu file</p>
        </div>
        <div class="batch-download-list">
    `;
    
    batchData.download_list.forEach(item => {
        downloadHTML += `
            <div class="batch-quality-section">
                <div class="batch-quality-header">
                    <span class="quality-name">${item.quality}</span>
                    <span class="quality-size">${item.size}</span>
                </div>
                <div class="batch-download-links">
                    ${item.links.map(link => `
                        <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="batch-link-btn">
                            ${link.host}
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    });
    
    downloadHTML += `</div>`;
    container.innerHTML = downloadHTML;
}

function displayAnimeDetail(anime, slug) {
    
    const container = document.getElementById('detailContent');
    
    const genres = anime.genres ? anime.genres.map(g => {
        const genreName = typeof g === 'object' ? g.name : g;
        const genreSlug = typeof g === 'object' && g.slug ? g.slug : genreName.toLowerCase();
        return `<span class="genre-tag" onclick="goToGenre('${genreSlug}')">${genreName}</span>`;
    }).join('') : '';
    
    // Check if batch download is available
    const hasBatch = anime.batch && anime.batch.slug;
    
    const episodeList = anime.episode_lists && anime.episode_lists.length > 0 ? `
        <div class="episode-section">
            <h2 class="section-title">Daftar Episode (${anime.episode_lists.length})</h2>
            <div class="episode-list">
                ${anime.episode_lists.map(ep => {
                    // Check if episode_number already contains "Episode", "OVA", "Movie", or "Special"
                    const epNum = ep.episode_number || 'N/A';
                    const needsPrefix = /^OVA|^Movie|^Special/i.test(epNum);
                    const displayText = needsPrefix ? epNum : `Episode ${epNum}`;
                    
                    return `
                        <button class="episode-btn" onclick="goToEpisode('${ep.slug}')">
                            ${displayText}
                        </button>
                    `;
                }).join('')}
            </div>
        </div>
    ` : '<p class="error">Tidak ada episode tersedia</p>';
    
    container.innerHTML = `
        <div class="detail-header">
            <img src="${anime.poster || 'https://via.placeholder.com/300x400/0f0f0f/e50914?text=No+Image'}" 
                 alt="${anime.title}" 
                 class="detail-poster"
                 onerror="this.src='https://via.placeholder.com/300x400/0f0f0f/e50914?text=No+Image'">
            
            <div class="detail-info">
                <h1>${anime.title}</h1>
                ${anime.japanese_title ? `<p style="color: #999; font-size: 1rem; margin-bottom: 15px;">${anime.japanese_title}</p>` : ''}
                
                <div class="detail-meta">
                    ${anime.status ? `<div class="meta-item"><span class="meta-label">Status:</span>${anime.status}</div>` : ''}
                    ${anime.rating ? `<div class="meta-item"><span class="meta-label">Rating:</span>${anime.rating}</div>` : ''}
                    ${anime.score ? `<div class="meta-item"><span class="meta-label">Score:</span>${anime.score}</div>` : ''}
                    ${anime.release_date ? `<div class="meta-item"><span class="meta-label">Rilis:</span>${anime.release_date}</div>` : ''}
                    ${anime.duration ? `<div class="meta-item"><span class="meta-label">Durasi:</span>${anime.duration}</div>` : ''}
                    ${anime.type ? `<div class="meta-item"><span class="meta-label">Tipe:</span>${anime.type}</div>` : ''}
                    ${anime.studio ? `<div class="meta-item"><span class="meta-label">Studio:</span>${anime.studio}</div>` : ''}
                    ${anime.episode_count ? `<div class="meta-item"><span class="meta-label">Total Episode:</span>${anime.episode_count}</div>` : ''}
                    ${anime.produser ? `<div class="meta-item"><span class="meta-label">Produser:</span>${anime.produser}</div>` : ''}
                </div>
                
                ${genres ? `<div class="genre-list">${genres}</div>` : ''}
                
                ${anime.synopsis ? `
                    <div class="detail-synopsis">
                        <h3>Sinopsis</h3>
                        <p>${anime.synopsis}</p>
                    </div>
                ` : ''}
                
            </div>
        </div>
        
        <!-- Tabs untuk Episodes dan Batch Download -->
        <div class="tabs-container">
            <div class="tabs-header">
                <button class="tab-btn active" onclick="switchTab('episodes')">📺 Episodes</button>
                ${hasBatch ? `<button class="tab-btn" onclick="switchTab('batch')">📥 Download Batch</button>` : ''}
            </div>
            
            <div class="tab-content active" id="episodesTab">
                ${episodeList}
            </div>
            
            ${hasBatch ? `
                <div class="tab-content" id="batchTab" style="display: none;">
                    <div id="batchDownloadContainer">
                        <div class="loading">Memuat download batch...</div>
                    </div>
                </div>
            ` : ''}
        
        ${anime.recommendations && anime.recommendations.length > 0 ? `
            <div class="recommendation-section">
                <h2 class="section-title">🎬 Rekomendasi Anime Lainnya</h2>
                <div class="recommendation-grid">
                    ${anime.recommendations.map(rec => `
                        <div class="recommendation-card" onclick="window.location.href='/detail/${rec.slug}'">
                            <img src="${rec.poster || 'https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image'}" 
                                 alt="${rec.title}" 
                                 class="recommendation-poster"
                                 onerror="this.src='https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image'">
                            <div class="recommendation-info">
                                <div class="recommendation-title" title="${rec.title}">${rec.title}</div>
                                <div class="recommendation-meta">
                                    ${rec.episode_count ? rec.episode_count + ' Episode' : ''}
                                    ${rec.rating ? ' • ⭐ ' + rec.rating : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
    `;
}

function goToEpisode(episodeSlug) {
    if (episodeSlug) {
        window.location.href = `/player/${episodeSlug}`;
    }
}

function goToGenre(genreSlug) {
    if (genreSlug) {
        window.location.href = `/genre/${genreSlug}`;
    }
}

function showError(message) {
    const container = document.getElementById('detailContent');
    container.innerHTML = `<div class="error">${message}</div>`;
}

document.addEventListener('DOMContentLoaded', () => {
    loadAnimeDetail();
});
