const API_BASE = '/api';

let currentEpisodeData = null;
let currentServerId = null;
const playerState = {
    fallbackUrl: '',
    mode: 'loading'
};

function getPlayerWrapper() {
    return document.getElementById('videoWrapper');
}

function getPlayerAlertBox() {
    return document.getElementById('playerAlert');
}

function updatePlayerAlert(message = '', type = 'info') {
    const alertBox = getPlayerAlertBox();
    if (!alertBox) return;
    if (!message) {
        alertBox.textContent = '';
        alertBox.classList.remove('visible', 'error');
        return;
    }
    alertBox.textContent = message;
    alertBox.classList.add('visible');
    if (type === 'error') {
        alertBox.classList.add('error');
    } else {
        alertBox.classList.remove('error');
    }
}

function showPlayerLoading(message = 'Menyiapkan pemutar...') {
    const wrapper = getPlayerWrapper();
    if (!wrapper) return;
    playerState.mode = 'loading';
    updatePlayerAlert('');
    wrapper.innerHTML = `
        <div class="player-loading">
            <span class="loader-dot"></span>
            <p>${message}</p>
        </div>
    `;
}

function showPlayerError(message) {
    const wrapper = getPlayerWrapper();
    if (!wrapper) return;
    playerState.mode = 'error';
    wrapper.innerHTML = `<div class="player-error">${message}</div>`;
    updatePlayerAlert(message, 'error');
}

function renderIframePlayer(url) {
    const wrapper = getPlayerWrapper();
    if (!wrapper) return;
    if (!url) {
        showPlayerError('Stream tidak tersedia untuk ditampilkan.');
        return;
    }
    playerState.mode = 'iframe';
    wrapper.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.id = 'videoPlayer';
    iframe.src = url;
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('webkitallowfullscreen', '');
    iframe.setAttribute('mozallowfullscreen', '');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation';
    iframe.allow = 'autoplay *; fullscreen *; encrypted-media *; accelerometer *; gyroscope *; picture-in-picture *; clipboard-write *; web-share *';
    wrapper.appendChild(iframe);
    updatePlayerAlert('Mode iframe aktif. Gunakan tombol fullscreen jika video masih tampak kecil.');
}

function renderVideoPlayer(resolvedData, fallbackUrl, options = {}) {
    const wrapper = getPlayerWrapper();
    if (!wrapper) return;
    const sources = Array.isArray(resolvedData?.sources) ? resolvedData.sources : [];
    if (!sources.length) {
        renderIframePlayer(fallbackUrl);
        return;
    }
    playerState.mode = 'video';
    wrapper.innerHTML = '';
    const video = document.createElement('video');
    video.id = 'videoPlayer';
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('controlsList', 'nodownload');
    video.setAttribute('webkit-playsinline', 'true');
    if (resolvedData.poster) {
        video.poster = resolvedData.poster;
    }
    if (options.autoplay) {
        video.autoplay = true;
    }
    sources.forEach((source) => {
        if (!source?.url) return;
        const sourceEl = document.createElement('source');
        sourceEl.src = source.url;
        if (source.mime) {
            sourceEl.type = source.mime;
        }
        if (source.quality) {
            sourceEl.setAttribute('data-quality', source.quality);
        }
        video.appendChild(sourceEl);
    });
    video.addEventListener('error', () => {
        updatePlayerAlert('Video gagal dimuat, mengganti ke mode iframe...', 'error');
        renderIframePlayer(fallbackUrl);
    });
    wrapper.appendChild(video);
    updatePlayerAlert('Mode direct player aktif. Klik tombol server lain jika ingin ganti sumber.');
}

function applyStreamToPlayer(streamPayload, options = {}) {
    const fallbackUrl = streamPayload?.stream_url || '';
    playerState.fallbackUrl = fallbackUrl;
    const resolvedData = streamPayload?.resolved;
    if (resolvedData && resolvedData.type === 'video') {
        renderVideoPlayer(resolvedData, fallbackUrl, options);
    } else {
        renderIframePlayer(fallbackUrl);
    }
}

async function resolveStreamFromUrl(streamUrl) {
    if (!streamUrl) return null;
    try {
        const encoded = encodeURIComponent(streamUrl);
        const response = await fetch(`${API_BASE}/resolve-stream?url=${encoded}`);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const payload = await response.json();
        if (payload.status === 'success') {
            return payload.data;
        }
    } catch (error) {
        console.error('Error resolving stream:', error);
    }
    return null;
}

async function initDefaultPlayer(defaultUrl) {
    if (!defaultUrl) {
        showPlayerError('Stream default tidak ditemukan.');
        return;
    }
    showPlayerLoading('Mengambil pemutar terbaik...');
    const resolved = await resolveStreamFromUrl(defaultUrl);
    if (resolved) {
        applyStreamToPlayer(resolved);
    } else {
        applyStreamToPlayer({ stream_url: defaultUrl });
    }
}

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

function getEpisodeSlugFromURL() {
    // Support both clean URL and query parameter
    const pathParts = window.location.pathname.split('/');
    
    // Clean URL: /player/episode-slug
    if (pathParts.length >= 3 && pathParts[1] === 'player' && pathParts[2]) {
        return pathParts[2];
    }
    
    // Fallback to query parameter: /player?episode=episode-slug
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('episode');
}

async function loadEpisodeData() {
    const episodeSlug = getEpisodeSlugFromURL();
    
    if (!episodeSlug) {
        showError('Episode tidak ditemukan!');
        return;
    }
    
    const data = await fetchAPI(`/episode/${episodeSlug}`);
    
    if (!data || !data.data) {
        showError('Data episode tidak ditemukan!');
        return;
    }
    
    currentEpisodeData = data.data;
    displayEpisodePlayer(data.data);
}

function displayEpisodePlayer(episode) {
    const container = document.getElementById('playerContent');
    
    // Default stream URL (will be loaded from streaming mirrors)
    let defaultStreamUrl = null;
    
    // Build download section from download_links structure
    let downloadSection = '';
    if (episode.download_links && episode.download_links.length > 0) {
        downloadSection = `
            <div class="download-section">
                <h3 class="section-title">Download Episode</h3>
                <div class="download-list">
                    ${episode.download_links.map(item => `
                        <div class="download-item">
                            <div class="download-quality">${item.quality} ${item.size ? `(${item.size})` : ''}</div>
                            <div class="download-links">
                                ${item.links.map(link => `
                                    <a href="${link.url}" target="_blank" class="download-btn">
                                        ${link.host}
                                    </a>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Set default stream URL from scraped iframe
    if (episode.default_stream_url) {
        defaultStreamUrl = episode.default_stream_url;
    }
    
    // Build streaming mirrors section with quality/server switching
    let streamingSection = '';
    if (episode.streaming_mirrors && episode.post_id) {
        const hasServers = Object.values(episode.streaming_mirrors).some(servers => servers && servers.length > 0);
        
        if (hasServers) {
            streamingSection = `
                <div class="streaming-section">
                    <h3 class="section-title">Pilih Kualitas & Server Streaming</h3>
                    <div class="streaming-mirrors">
                        ${Object.keys(episode.streaming_mirrors).map(quality => {
                            const servers = episode.streaming_mirrors[quality];
                            if (!servers || servers.length === 0) return '';
                            
                            return `
                                <div class="quality-group">
                                    <div class="quality-label">${quality}</div>
                                    <div class="server-buttons">
                                        ${servers.map((server, idx) => {
                                            const isDefaultActive = idx === 0 && quality === '480p';
                                            return `
                                                <button class="server-btn ${isDefaultActive ? 'active' : ''}" 
                                                        onclick="changeServer('${episode.post_id}', '${quality}', ${idx}, '${server.server}', this)">
                                                    ${server.server}
                                                </button>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }
    }
    
    // Navigation buttons
    const prevBtn = episode.prev_episode ? 
        `<a href="/player/${episode.prev_episode}" class="nav-btn">← Episode Sebelumnya</a>` : 
        `<span class="nav-btn disabled">← Episode Sebelumnya</span>`;
    
    const nextBtn = episode.next_episode ? 
        `<a href="/player/${episode.next_episode}" class="nav-btn">Episode Selanjutnya →</a>` : 
        `<span class="nav-btn disabled">Episode Selanjutnya →</span>`;
    
    // Extract anime slug from detail URL
    let animeSlug = '';
    if (episode.anime_detail_url) {
        const match = episode.anime_detail_url.match(/\/anime\/([^\/]+)/);
        animeSlug = match ? match[1] : '';
    }
    
    playerState.fallbackUrl = defaultStreamUrl || '';
    container.innerHTML = `
        <div class="video-wrapper" id="videoWrapper">
            <div class="player-loading">
                <span class="loader-dot"></span>
                <p>Menyiapkan video player...</p>
            </div>
        </div>
        <div id="playerAlert" class="player-alert" role="status" aria-live="polite"></div>
        
        <div class="episode-info">
            <h2 class="episode-title">${episode.title || 'Episode'}</h2>
            ${animeSlug ? 
                `<p style="color: #999; margin-top: 10px;">
                    <a href="/detail/${animeSlug}" 
                       style="color: #e50914; text-decoration: none;">
                        ← Kembali ke Detail Anime
                    </a>
                </p>` : ''
            }
        </div>
        
        ${streamingSection}
        
        <div class="navigation-section">
            ${prevBtn}
            ${nextBtn}
        </div>
        
        ${downloadSection}
    `;

    updatePlayerAlert('');
    if (defaultStreamUrl) {
        initDefaultPlayer(defaultStreamUrl);
    } else {
        showPlayerError('Stream default tidak ditemukan.');
    }
}

async function changeServer(postId, quality, serverIndex, serverName, buttonElement) {
    const wrapper = getPlayerWrapper();
    if (!wrapper) return;
    
    // Show loading state
    const originalText = buttonElement.textContent;
    buttonElement.textContent = 'Loading...';
    buttonElement.disabled = true;
    showPlayerLoading(`Menghubungkan ke ${serverName} (${quality})...`);
    
    try {
        // Fetch stream URL from our API
        const response = await fetch(`${API_BASE}/stream/${postId}/${quality}/${serverIndex}?resolve=1`);
        const data = await response.json();
        
        if (data.status === 'success' && data.data.stream_url) {
            applyStreamToPlayer(data.data, { autoplay: true });
            document.querySelectorAll('.server-btn').forEach(btn => btn.classList.remove('active'));
            buttonElement.classList.add('active');
            console.log(`✓ Switched to ${serverName} (${quality})`);
        } else {
            throw new Error('Failed to get stream URL');
        }
    } catch (error) {
        console.error('Error switching server:', error);
        alert(`Gagal mengganti server. Silakan coba server lain atau refresh halaman.`);
        if (playerState.fallbackUrl) {
            renderIframePlayer(playerState.fallbackUrl);
        }
    } finally {
        // Restore button state
        buttonElement.textContent = originalText;
        buttonElement.disabled = false;
    }
}

function showError(message) {
    const container = document.getElementById('playerContent');
    container.innerHTML = `<div class="error">${message}</div>`;
}

document.addEventListener('DOMContentLoaded', () => {
    loadEpisodeData();
});
