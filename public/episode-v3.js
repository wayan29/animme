// Episode Player V3 - Kuramanime
let episodeData = null;
let currentServer = null;
let currentQuality = null;

// Get URL parameters
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        animeId: params.get('animeId') || '4081',
        slug: params.get('slug') || 'ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga',
        episode: params.get('episode') || '1'
    };
}

// Fetch episode data from API
async function fetchEpisodeData() {
    const { animeId, slug, episode } = getUrlParams();
    const apiUrl = `/api/v3/kuramanime/episode/${animeId}/${slug}/${episode}`;
    
    try {
        const response = await fetch(apiUrl);
        const result = await response.json();
        
        if (result.status === 'success') {
            episodeData = result.data;
            renderPage();
        } else {
            showError('Failed to load episode data');
        }
    } catch (error) {
        console.error('Error fetching episode:', error);
        showError('Network error. Please try again.');
    }
}

// Render the entire page
function renderPage() {
    if (!episodeData) return;
    
    // Update header
    document.getElementById('episodeTitle').textContent = episodeData.title;
    document.getElementById('animeTitle').textContent = episodeData.anime_title;
    document.getElementById('episodeNum').textContent = episodeData.episode;
    
    // Update page title
    document.title = `${episodeData.anime_title} Episode ${episodeData.episode}`;
    
    // Render server selector
    renderServerSelector();
    
    // Render episode list
    renderEpisodeList();
    
    // Render download links
    renderDownloadLinks();
    
    // Setup navigation
    setupNavigation();
    
    // Load default server
    const defaultServer = episodeData.streaming_servers.find(s => s.selected) || 
                          episodeData.streaming_servers[0];
    if (defaultServer) {
        loadServer(defaultServer.value);
    }
}

// Render server selector
function renderServerSelector() {
    const serverSelect = document.getElementById('serverSelect');
    serverSelect.innerHTML = '';
    
    episodeData.streaming_servers.forEach((server, index) => {
        const option = document.createElement('option');
        option.value = server.value;
        option.textContent = server.name;
        
        // Add source count info
        if (server.sources && server.sources.length > 0) {
            if (server.sources[0].quality === 'iframe') {
                option.textContent += ' [Iframe]';
            } else {
                option.textContent += ` [${server.sources.length} quality]`;
            }
        }
        
        if (server.selected) {
            option.selected = true;
        }
        
        serverSelect.appendChild(option);
    });
    
    console.log('Rendered servers:', episodeData.streaming_servers.length);
    console.log('Server select options count:', serverSelect.options.length);
    
    // Log all options
    for (let i = 0; i < serverSelect.options.length; i++) {
        console.log(`  Option ${i}: ${serverSelect.options[i].text}`);
    }
    
    serverSelect.addEventListener('change', (e) => {
        loadServer(e.target.value);
    });
}

// Load server and video sources
function loadServer(serverValue) {
    console.log('Loading server:', serverValue);
    
    const server = episodeData.streaming_servers.find(s => s.value === serverValue);
    if (!server) {
        console.error('Server not found:', serverValue);
        return;
    }
    
    console.log('Server found:', server.name);
    console.log('Server has sources:', server.sources ? server.sources.length : 0);
    
    currentServer = server;
    
    // Show loading
    showLoading();
    
    // Check if server has sources
    if (!server.sources || server.sources.length === 0) {
        console.error('No sources for server:', server.name);
        showError('No sources available for this server');
        return;
    }
    
    const sources = server.sources;
    console.log('Sources:', sources.map(s => s.quality).join(', '));
    
    // Check if it's iframe or direct video
    if (sources[0].quality === 'iframe') {
        console.log('Loading iframe for:', server.name);
        loadIframe(sources[0].url);
        hideQualitySelector();
    } else {
        console.log('Loading direct video with quality selector');
        renderQualitySelector(sources);
        loadVideo(sources);
    }
}

// Render quality selector for direct video
function renderQualitySelector(sources) {
    const qualityControl = document.getElementById('qualityControl');
    const qualitySelect = document.getElementById('qualitySelect');
    
    qualitySelect.innerHTML = '';
    
    console.log('Rendering quality selector with sources:', sources.length);
    
    sources.forEach((source, index) => {
        const option = document.createElement('option');
        option.value = source.quality;
        option.textContent = `${source.quality} (${source.type.includes('mp4') ? 'MP4' : 'Video'})`;
        qualitySelect.appendChild(option);
        console.log(`  Quality ${index + 1}: ${source.quality}`);
    });
    
    // Select highest quality by default (first in array)
    if (sources.length > 0) {
        qualitySelect.value = sources[0].quality;
        currentQuality = sources[0].quality;
        console.log('Selected default quality:', currentQuality);
    }
    
    // Show quality control
    qualityControl.style.display = 'flex';
    console.log('Quality control displayed:', qualityControl.style.display);
    console.log('Quality select options count:', qualitySelect.options.length);
    
    // Log all quality options
    for (let i = 0; i < qualitySelect.options.length; i++) {
        console.log(`  Quality option ${i}: ${qualitySelect.options[i].text}`);
    }
    
    // Remove old listeners by cloning (includes all child options)
    const newSelect = qualitySelect.cloneNode(true);
    qualityControl.replaceChild(newSelect, qualitySelect);
    
    newSelect.addEventListener('change', (e) => {
        currentQuality = e.target.value;
        console.log('Quality changed to:', currentQuality);
        const currentTime = getCurrentVideoTime();
        loadVideo(sources, currentTime);
    });
}

// Hide quality selector
function hideQualitySelector() {
    document.getElementById('qualityControl').style.display = 'none';
}

// Get current video time
function getCurrentVideoTime() {
    const video = document.querySelector('#videoContainer video');
    return video ? video.currentTime : 0;
}

// Load direct video
function loadVideo(sources, startTime = 0) {
    const container = document.getElementById('videoContainer');
    
    console.log('Loading video with', sources.length, 'sources');
    console.log('Start time:', startTime);
    
    // Clear container
    container.innerHTML = '';
    
    // Create video element
    const video = document.createElement('video');
    video.controls = true;
    video.controlsList = 'nodownload';
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.preload = 'metadata';
    video.style.width = '100%';
    video.style.height = '100%';
    
    // Add sources - prioritize selected quality
    const selectedSource = sources.find(s => s.quality === currentQuality) || sources[0];
    console.log('Selected quality source:', selectedSource.quality);
    
    // Add all sources to video element
    sources.forEach((source, index) => {
        const sourceElement = document.createElement('source');
        sourceElement.src = source.url;
        sourceElement.type = source.type;
        sourceElement.setAttribute('size', source.quality.replace('p', ''));
        sourceElement.setAttribute('label', source.quality);
        video.appendChild(sourceElement);
        console.log(`  Source ${index + 1}: ${source.quality} - ${source.url.substring(0, 50)}...`);
    });
    
    container.appendChild(video);
    
    // Set start time and play
    video.addEventListener('loadedmetadata', () => {
        console.log('Video metadata loaded');
        if (startTime > 0) {
            video.currentTime = startTime;
            console.log('Set video time to:', startTime);
        }
        hideLoading();
    });
    
    // Handle errors
    video.addEventListener('error', (e) => {
        console.error('Video error:', e);
        showError('Failed to load video. Try another server or quality.');
    });
    
    // Log when video starts playing
    video.addEventListener('playing', () => {
        console.log('Video is playing');
    });
}

// Load iframe
function loadIframe(url) {
    const container = document.getElementById('videoContainer');
    
    // Clear container
    container.innerHTML = '';
    
    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.allowFullscreen = true;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    
    container.appendChild(iframe);
    
    // Hide loading after a delay
    setTimeout(() => hideLoading(), 1000);
}

// Show loading overlay
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
    } else {
        const container = document.getElementById('videoContainer');
        const newOverlay = document.createElement('div');
        newOverlay.className = 'loading-overlay';
        newOverlay.id = 'loadingOverlay';
        newOverlay.innerHTML = '<div class="spinner"></div>';
        container.appendChild(newOverlay);
    }
}

// Hide loading overlay
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Show error message
function showError(message) {
    const container = document.getElementById('videoContainer');
    container.innerHTML = `
        <div class="error-message">
            <h3>⚠️ Error</h3>
            <p>${message}</p>
        </div>
    `;
}

// Render episode list
function renderEpisodeList() {
    const container = document.getElementById('episodeList');
    container.innerHTML = '';
    
    if (!episodeData.episode_list || episodeData.episode_list.length === 0) {
        container.innerHTML = '<div class="loading-message">No episodes available</div>';
        return;
    }
    
    episodeData.episode_list.forEach(ep => {
        const btn = document.createElement('button');
        btn.className = 'episode-btn';
        btn.textContent = `Ep ${ep.episode}`;
        
        if (ep.is_active) {
            btn.classList.add('active');
        }
        
        if (ep.is_new) {
            btn.classList.add('new');
        }
        
        btn.addEventListener('click', () => {
            navigateToEpisode(ep.url);
        });
        
        container.appendChild(btn);
    });
}

// Navigate to episode
function navigateToEpisode(url) {
    // Extract parameters from URL
    const match = url.match(/\/anime\/(\d+)\/([^\/]+)\/episode\/(\d+)/);
    if (match) {
        const [, animeId, slug, episode] = match;
        window.location.href = `episode-v3.html?animeId=${animeId}&slug=${slug}&episode=${episode}`;
    }
}

// Render download links
function renderDownloadLinks() {
    const container = document.getElementById('downloadContainer');
    container.innerHTML = '';
    
    if (!episodeData.download_links || episodeData.download_links.length === 0) {
        container.innerHTML = '<div class="loading-message">No download links available</div>';
        return;
    }
    
    // Group by quality
    const grouped = {};
    episodeData.download_links.forEach(link => {
        if (!grouped[link.quality]) {
            grouped[link.quality] = [];
        }
        grouped[link.quality].push(link);
    });
    
    // Render each quality group
    Object.entries(grouped).forEach(([quality, links]) => {
        const qualityGroup = document.createElement('div');
        qualityGroup.className = 'quality-group';
        
        const header = document.createElement('h3');
        header.textContent = `${quality} (${links[0].size})`;
        qualityGroup.appendChild(header);
        
        const linksContainer = document.createElement('div');
        linksContainer.className = 'download-links';
        
        links.forEach(link => {
            const a = document.createElement('a');
            a.href = link.url;
            a.className = 'download-btn';
            a.textContent = link.provider;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            linksContainer.appendChild(a);
        });
        
        qualityGroup.appendChild(linksContainer);
        container.appendChild(qualityGroup);
    });
}

// Setup navigation buttons
function setupNavigation() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const detailBtn = document.getElementById('detailBtn');
    
    // Previous episode
    if (episodeData.navigation.prev_episode) {
        prevBtn.classList.remove('disabled');
        prevBtn.href = convertToPlayerUrl(episodeData.navigation.prev_episode);
    } else {
        prevBtn.classList.add('disabled');
        prevBtn.onclick = (e) => e.preventDefault();
    }
    
    // Next episode
    if (episodeData.navigation.next_episode) {
        nextBtn.classList.remove('disabled');
        nextBtn.href = convertToPlayerUrl(episodeData.navigation.next_episode);
    } else {
        nextBtn.classList.add('disabled');
        nextBtn.onclick = (e) => e.preventDefault();
    }
    
    // Detail page
    if (episodeData.anime_detail_url) {
        detailBtn.href = episodeData.anime_detail_url;
        detailBtn.target = '_blank';
    }
}

// Convert original URL to player URL
function convertToPlayerUrl(url) {
    const match = url.match(/\/anime\/(\d+)\/([^\/]+)\/episode\/(\d+)/);
    if (match) {
        const [, animeId, slug, episode] = match;
        return `episode-v3.html?animeId=${animeId}&slug=${slug}&episode=${episode}`;
    }
    return url;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    fetchEpisodeData();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Space = play/pause
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        const video = document.querySelector('#videoContainer video');
        if (video) {
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        }
    }
    
    // Arrow left = previous episode
    if (e.code === 'ArrowLeft' && episodeData?.navigation.prev_episode) {
        window.location.href = convertToPlayerUrl(episodeData.navigation.prev_episode);
    }
    
    // Arrow right = next episode
    if (e.code === 'ArrowRight' && episodeData?.navigation.next_episode) {
        window.location.href = convertToPlayerUrl(episodeData.navigation.next_episode);
    }
});
