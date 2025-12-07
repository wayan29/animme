// Episode Player V3 - Kuramanime
let episodeData = null;
let currentServer = null;
let currentQuality = null;
let playerSettings = null;
let currentEpisodeId = null;
let hlsInstance = null; // HLS.js instance for HLS streaming
let currentHLSSession = null; // Current HLS conversion session (primary quality)
let allHLSSessions = []; // All HLS sessions (all qualities) for cleanup
let qualitySessionMap = new Map(); // Map quality -> sessionData for switching
let availableQualities = []; // Available qualities from sources
let youtubePlayer = null; // YouTube-style player instance

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

    // Load player settings
    if (typeof PlayerConfig !== 'undefined') {
        playerSettings = PlayerConfig.loadSettings();
        console.log('Player settings loaded:', playerSettings);
    }

    // Set current episode ID for resume functionality
    currentEpisodeId = `v3-${animeId}-${slug}-ep${episode}`;

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

    // Render episode list
    renderEpisodeList();

    // Render download links
    renderDownloadLinks();

    // Setup navigation
    setupNavigation();

    // Load default server (kuramadrive HLS)
    const defaultServer = episodeData.streaming_servers.find(s => s.selected) ||
        episodeData.streaming_servers[0];
    if (defaultServer) {
        loadServer(defaultServer.value);
    }
}

// Server selector removed - using kuramadrive HLS by default

// Load server and video sources
function loadServer(serverValue) {
    console.log('Loading server:', serverValue);

    // Cleanup HLS instance and all sessions when switching servers
    cleanupHLS();
    cleanupAllHLSSessions();

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

    // Check if it's Kuramadrive - convert all qualities to HLS
    if (isKuramadrive(server.name)) {
        console.log('Detected Kuramadrive server, converting all qualities to HLS...');

        // Show conversion loading message
        showConversionLoading();

        // Store available qualities for selector
        availableQualities = sources.map(s => s.quality);
        console.log('Available qualities:', availableQualities.join(', '));

        // Convert all qualities (sorted from lowest to highest: 360p, 480p, 720p, 1080p)
        console.log('Converting', sources.length, 'qualities:', sources.map(s => s.quality).join(', '));

        // Start with lowest quality first (360p) for fast playback
        const lowestQuality = sources[0];
        console.log('Starting with lowest quality for fast playback:', lowestQuality.quality);

        // Request HLS conversion for lowest quality
        requestHLSConversion(lowestQuality.url, currentEpisodeId, lowestQuality.quality)
            .then(sessionData => {
                // Store session
                currentHLSSession = sessionData;
                allHLSSessions.push(sessionData.sessionId);
                qualitySessionMap.set(lowestQuality.quality, sessionData);
                currentQuality = lowestQuality.quality;

                // Load HLS with lowest quality first
                const hlsUrl = sessionData.playlistUrl;
                console.log('Loading converted HLS (lowest quality):', hlsUrl);
                loadVideoWithHLS(hlsUrl, 0);

                // Small delay to ensure video element is created and YouTube player initialized
                setTimeout(() => {
                    // Setup YouTube player quality menu for Kuramadrive
                    setupKuramaDriveQualityMenu(sources);
                }, 500);

                // Convert other qualities in background
                if (sources.length > 1) {
                    console.log('Converting', sources.length - 1, 'higher qualities in background...');
                    sources.slice(1).forEach((source, index) => {
                        setTimeout(() => {
                            console.log(`Background conversion ${index + 1}/${sources.length - 1}:`, source.quality);
                            requestHLSConversion(source.url, currentEpisodeId, source.quality)
                                .then(data => {
                                    console.log(`✓ ${source.quality} ready:`, data.playlistUrl);
                                    allHLSSessions.push(data.sessionId);
                                    qualitySessionMap.set(source.quality, data);
                                    // Update quality selector to show it's ready
                                    updateQualityOption(source.quality, true);
                                })
                                .catch(err => {
                                    console.warn(`✗ ${source.quality} conversion failed:`, err.message);
                                    updateQualityOption(source.quality, false);
                                });
                        }, index * 5000); // Stagger conversions by 5 seconds
                    });
                }
            })
            .catch(error => {
                console.error('HLS conversion failed:', error);
                showError('Gagal mengkonversi video. Silakan coba server lain atau refresh halaman.');
            });

        return;
    }

    // Check if it's iframe or direct video
    if (sources[0].quality === 'iframe') {
        console.log('Loading iframe for:', server.name);
        loadIframe(sources[0].url);
        hideQualitySelector();
    } else {
        // Load direct video with all qualities
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

    // Select lowest quality by default (360p) for fast loading
    // Higher qualities will be available in selector
    if (sources.length > 0) {
        qualitySelect.value = sources[0].quality;
        currentQuality = sources[0].quality;
        console.log('Selected default quality (lowest for fast loading):', currentQuality);
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

// Setup Kuramadrive quality menu in YouTube player UI
function setupKuramaDriveQualityMenu(sources) {
    if (!youtubePlayer) {
        console.error('YouTube player not initialized');
        return;
    }

    console.log('Setting up Kuramadrive quality menu in YouTube player UI');
    console.log('Available qualities:', sources.map(s => s.quality).join(', '));

    // Build quality options array with status
    const qualityOptions = sources.map((source, index) => ({
        quality: source.quality,
        ready: index === 0, // First is ready, others converting
        label: index === 0 ? `${source.quality} ✓` : `${source.quality} (converting...)`
    }));

    // Store quality options for updates
    window.kuramaDriveQualityOptions = qualityOptions;

    // Set custom quality menu callback
    youtubePlayer.onQualityMenuClick = () => {
        console.log('Quality menu clicked in YouTube player');

        // Use updated quality options from window (not the closure variable)
        const currentOptions = window.kuramaDriveQualityOptions || qualityOptions;

        // Build quality list with current status
        const qualityLabels = currentOptions.map(opt => opt.label);

        console.log('Showing quality options:', qualityLabels);

        // Show YouTube player quality menu
        youtubePlayer.showOptionsMenu('Quality', qualityLabels, (selectedLabel) => {
            // Find quality from label (use currentOptions for matching)
            const selected = currentOptions.find(opt => opt.label === selectedLabel);
            if (!selected) {
                console.error('Selected quality not found:', selectedLabel);
                return;
            }

            const quality = selected.quality;
            console.log('User selected quality from YouTube menu:', quality, 'Ready:', selected.ready);

            if (selected.ready) {
                // Quality is ready, switch now
                switchKuramaDriveQuality(quality);
            } else {
                // Quality not ready yet
                showError(`Quality ${quality} sedang di-convert. Mohon tunggu...`);
            }
        });
    };

    // Update quality value in YouTube player
    youtubePlayer.elements.qualityValue.textContent = sources[0].quality;

    // Hide old dropdown quality selector (we're using YouTube player UI now)
    const qualityControl = document.getElementById('qualityControl');
    if (qualityControl) {
        qualityControl.style.display = 'none';
        console.log('Dropdown quality selector hidden (using YouTube player UI)');
    }

    console.log('YouTube player quality menu configured');
}

// Update quality option status (converting -> ready)
function updateQualityOption(quality, isReady) {
    console.log(`Updating quality option: ${quality} - Ready:`, isReady);

    // Update YouTube player quality options array
    if (window.kuramaDriveQualityOptions) {
        const option = window.kuramaDriveQualityOptions.find(opt => opt.quality === quality);
        if (option) {
            option.ready = isReady;
            option.label = isReady ? `${quality} ✓` : `${quality} (failed)`;
            console.log(`YouTube player quality option updated: ${quality} - ${option.label}`);
        }
    }

    // Also update dropdown select if it exists (legacy support)
    const qualitySelect = document.getElementById('qualitySelect');
    if (qualitySelect) {
        const selectOption = qualitySelect.querySelector(`option[data-quality="${quality}"]`);
        if (selectOption) {
            if (isReady) {
                selectOption.textContent = `${quality} ✓`;
                selectOption.dataset.ready = 'true';
                selectOption.disabled = false;
            } else {
                selectOption.textContent = `${quality} (failed)`;
                selectOption.dataset.ready = 'false';
                selectOption.disabled = true;
            }
        }
    }
}

// Switch to different quality for Kuramadrive
function switchKuramaDriveQuality(quality) {
    console.log('=== switchKuramaDriveQuality called ===');
    console.log('Requested quality:', quality);
    console.log('Current quality:', currentQuality);
    console.log('Available sessions:', Array.from(qualitySessionMap.keys()));

    // Don't switch if already on this quality
    if (quality === currentQuality) {
        console.log('Already on this quality, skipping switch');
        return;
    }

    // Check if quality is ready
    const sessionData = qualitySessionMap.get(quality);
    console.log('Session data for', quality, ':', sessionData ? 'FOUND' : 'NOT FOUND');

    if (!sessionData) {
        console.warn('Quality not ready yet:', quality);
        console.log('Available qualities in map:', Array.from(qualitySessionMap.entries()));
        showError(`Quality ${quality} sedang di-convert. Mohon tunggu...`);

        // Revert selector to current quality
        const qualitySelect = document.getElementById('qualitySelect');
        if (qualitySelect) {
            qualitySelect.value = currentQuality;
            console.log('Reverted selector to:', currentQuality);
        }
        return;
    }

    // Get current time to resume playback
    const currentTime = getCurrentVideoTime();
    console.log('Current playback time:', currentTime, 'seconds');

    // Update current quality
    const oldQuality = currentQuality;
    currentQuality = quality;
    currentHLSSession = sessionData;
    console.log('Quality switched from', oldQuality, 'to', quality);

    // Update YouTube player quality display
    if (youtubePlayer && youtubePlayer.elements) {
        youtubePlayer.elements.qualityValue.textContent = quality;
        console.log('Updated YouTube player quality value to:', quality);

        // Update quality badge
        if (youtubePlayer.elements.qualityBadge) {
            youtubePlayer.elements.qualityBadge.style.display = '';
            youtubePlayer.elements.qualityBadge.textContent = quality.toUpperCase();
            console.log('Updated quality badge to:', quality.toUpperCase());
        }

        // Show notification
        youtubePlayer.showNotification(`Quality: ${quality}`);
    } else {
        console.warn('YouTube player not available for UI update');
    }

    // Load HLS with new quality
    console.log('Loading HLS with new quality');
    console.log('  Quality:', quality);
    console.log('  Session ID:', sessionData.sessionId);
    console.log('  Playlist URL:', sessionData.playlistUrl);
    console.log('  Resume time:', currentTime);

    loadVideoWithHLS(sessionData.playlistUrl, currentTime);

    // Re-setup quality menu callback after new YouTube player is created
    setTimeout(() => {
        reattachKuramaDriveQualityMenu();
    }, 500);

    console.log('=== Quality switch complete ===');
}

// Re-attach Kuramadrive quality menu to new YouTube player after quality switch
function reattachKuramaDriveQualityMenu() {
    if (!youtubePlayer || !window.kuramaDriveQualityOptions) {
        console.warn('Cannot reattach quality menu - player or options not available');
        return;
    }

    console.log('Re-attaching Kuramadrive quality menu to new YouTube player');

    // Set custom quality menu callback
    youtubePlayer.onQualityMenuClick = () => {
        console.log('Quality menu clicked in YouTube player (reattached)');

        // Use updated quality options from window
        const currentOptions = window.kuramaDriveQualityOptions;

        // Build quality list with current status
        const qualityLabels = currentOptions.map(opt => opt.label);

        console.log('Showing quality options:', qualityLabels);

        // Show YouTube player quality menu
        youtubePlayer.showOptionsMenu('Quality', qualityLabels, (selectedLabel) => {
            // Find quality from label
            const selected = currentOptions.find(opt => opt.label === selectedLabel);
            if (!selected) {
                console.error('Selected quality not found:', selectedLabel);
                return;
            }

            const quality = selected.quality;
            console.log('User selected quality from YouTube menu:', quality, 'Ready:', selected.ready);

            if (selected.ready) {
                // Quality is ready, switch now
                switchKuramaDriveQuality(quality);
            } else {
                // Quality not ready yet
                showError(`Quality ${quality} sedang di-convert. Mohon tunggu...`);
            }
        });
    };

    // Update quality value in YouTube player
    youtubePlayer.elements.qualityValue.textContent = currentQuality;

    // Update quality badge
    if (youtubePlayer.elements.qualityBadge) {
        youtubePlayer.elements.qualityBadge.style.display = '';
        youtubePlayer.elements.qualityBadge.textContent = currentQuality.toUpperCase();
    }

    console.log('Kuramadrive quality menu reattached');
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

// Check if URL is HLS stream
function isHLSStream(url) {
    return url && (url.includes('.m3u8') || url.toLowerCase().endsWith('.m3u8'));
}

// Check if server is Kuramadrive
function isKuramadrive(serverName) {
    return serverName && serverName.toLowerCase().includes('kuramadrive');
}

// Request HLS conversion from server
async function requestHLSConversion(videoUrl, episodeId, quality = 'auto') {
    console.log('Requesting HLS conversion for:', videoUrl, 'Quality:', quality);

    try {
        const response = await fetch('/api/hls/convert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                videoUrl: videoUrl,
                episodeId: episodeId,
                quality: quality
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            console.log('HLS conversion successful:', result.data);
            return result.data;
        } else {
            throw new Error(result.message || 'Conversion failed');
        }
    } catch (error) {
        console.error('HLS conversion request failed:', error);
        throw error;
    }
}

// Close HLS session
async function closeHLSSession(sessionId) {
    if (!sessionId) return;

    console.log('Closing HLS session:', sessionId);

    try {
        const response = await fetch(`/api/hls/close/${sessionId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        console.log('Session closed:', result);
    } catch (error) {
        console.error('Error closing session:', error);
    }
}

// Close all HLS sessions (all qualities)
async function cleanupAllHLSSessions() {
    if (allHLSSessions.length === 0) return;

    console.log('Cleaning up all HLS sessions:', allHLSSessions.length, 'session(s)');

    // Close all sessions
    const closePromises = allHLSSessions.map(sessionId => closeHLSSession(sessionId));
    await Promise.all(closePromises);

    // Clear all data structures
    allHLSSessions = [];
    currentHLSSession = null;
    qualitySessionMap.clear();
    availableQualities = [];

    // Clear Kuramadrive quality options
    if (window.kuramaDriveQualityOptions) {
        delete window.kuramaDriveQualityOptions;
    }

    // Reset YouTube player quality callback
    if (youtubePlayer) {
        youtubePlayer.onQualityMenuClick = null;
    }

    console.log('All HLS sessions cleaned up');
}

// Initialize YouTube Player
function initializeYouTubePlayer(videoElement, containerElement) {
    try {
        // Destroy existing player
        if (youtubePlayer) {
            youtubePlayer.destroy();
            youtubePlayer = null;
        }

        // Check if YouTubePlayer class is available
        if (typeof YouTubePlayer === 'undefined') {
            console.warn('YouTube Player not loaded, using native controls');
            videoElement.controls = true;
            return;
        }

        // Create new YouTube player
        youtubePlayer = new YouTubePlayer(containerElement, videoElement);

        // Show skip buttons if enabled in settings


        // Set quality badge if available
        if (currentQuality && currentQuality !== 'auto') {
            const badge = containerElement.querySelector('[data-quality-badge]');
            if (badge) {
                badge.style.display = '';
                badge.textContent = currentQuality.toUpperCase();
            }
        }

        console.log('✨ YouTube Player initialized successfully!');
    } catch (error) {
        console.error('Error initializing YouTube Player:', error);
        // Fallback to native controls
        videoElement.controls = true;
    }
}

// Cleanup HLS instance
function cleanupHLS() {
    if (hlsInstance) {
        console.log('Cleaning up HLS instance');
        hlsInstance.destroy();
        hlsInstance = null;
    }
}

// Setup YouTube Player quality integration with HLS
function setupYouTubePlayerQuality(levels, hls) {
    console.log('Setting up YouTube Player quality integration with HLS');

    // Sort levels by height (low to high)
    const sortedLevels = levels
        .map((level, originalIndex) => ({ ...level, originalIndex }))
        .sort((a, b) => a.height - b.height);

    // Create quality options (Auto + all available levels)
    const qualityOptions = ['Auto', ...sortedLevels.map(l => `${l.height}p`)];

    // Get default quality from settings
    const defaultQuality = playerSettings?.defaultQuality || 'auto';

    // Set current quality in YouTube player
    if (defaultQuality === 'auto') {
        youtubePlayer.setQuality('Auto');
    } else {
        const matchingLevel = sortedLevels.find(l => l.height === parseInt(defaultQuality));
        if (matchingLevel) {
            youtubePlayer.setQuality(`${matchingLevel.height}p`);
            hls.currentLevel = matchingLevel.originalIndex;
        }
    }

    // Set up quality menu click handler
    youtubePlayer.onQualityMenuClick = () => {
        youtubePlayer.showOptionsMenu('Quality', qualityOptions, (selectedQuality, index) => {
            if (index === 0) {
                // Auto quality
                hls.currentLevel = -1;
                youtubePlayer.setQuality('Auto');
                console.log('HLS quality: Auto (Adaptive)');

                // Save preference
                if (typeof PlayerConfig !== 'undefined') {
                    const settings = PlayerConfig.loadSettings();
                    settings.defaultQuality = 'auto';
                    PlayerConfig.saveSettings(settings);
                }
            } else {
                // Manual quality - index-1 because Auto is first
                const level = sortedLevels[index - 1];
                hls.currentLevel = level.originalIndex;
                youtubePlayer.setQuality(`${level.height}p`);
                console.log(`HLS quality switched to: ${level.height}p - ${Math.round(level.bitrate / 1000)} kbps`);

                // Save preference
                if (typeof PlayerConfig !== 'undefined') {
                    const settings = PlayerConfig.loadSettings();
                    settings.defaultQuality = level.height;
                    PlayerConfig.saveSettings(settings);
                    console.log(`Quality preference saved: ${level.height}p`);
                }
            }
        });
    };

    console.log('YouTube Player quality integration complete');
}

// Setup HLS quality selector
function setupHLSQualitySelector(levels, hls) {
    // If YouTube player is available, integrate with it
    if (youtubePlayer) {
        setupYouTubePlayerQuality(levels, hls);
        return;
    }

    // Fallback to old dropdown method
    const qualityControl = document.getElementById('qualityControl');
    const qualitySelect = document.getElementById('qualitySelect');

    if (!qualityControl || !qualitySelect) return;

    // Clear existing options
    qualitySelect.innerHTML = '';

    // Sort levels by height (low to high)
    const sortedLevels = levels
        .map((level, index) => ({ ...level, originalIndex: index }))
        .sort((a, b) => (a.height || 0) - (b.height || 0));

    // Add auto option first
    const autoOption = document.createElement('option');
    autoOption.value = '-1';
    autoOption.textContent = 'Auto (Adaptive) ✨';
    qualitySelect.appendChild(autoOption);

    // Add manual quality options (sorted low to high)
    sortedLevels.forEach((level) => {
        const option = document.createElement('option');
        option.value = level.originalIndex;
        const height = level.height || 'Unknown';
        const bitrate = Math.round(level.bitrate / 1000);
        option.textContent = `${height}p - ${bitrate} kbps`;
        qualitySelect.appendChild(option);
    });

    // Check for default quality preference from settings
    let defaultQuality = playerSettings?.defaultQuality || 'auto';

    // Set default selection
    if (defaultQuality === 'auto') {
        qualitySelect.value = '-1';
        hls.currentLevel = -1;
    } else {
        // Find matching quality level
        const targetHeight = parseInt(defaultQuality); // e.g., 480 from "480p"
        const matchingLevel = sortedLevels.find(l => l.height === targetHeight);

        if (matchingLevel) {
            qualitySelect.value = matchingLevel.originalIndex;
            hls.currentLevel = matchingLevel.originalIndex;
            console.log(`Starting with preferred quality: ${targetHeight}p`);
        } else {
            qualitySelect.value = '-1';
            hls.currentLevel = -1;
        }
    }

    // Show quality control
    qualityControl.style.display = 'flex';

    // Handle quality change
    qualitySelect.addEventListener('change', (e) => {
        const levelIndex = parseInt(e.target.value);

        if (levelIndex === -1) {
            // Enable auto quality switching
            hls.currentLevel = -1;
            console.log('HLS quality: Auto (Adaptive)');

            // Save preference
            if (typeof PlayerConfig !== 'undefined') {
                const settings = PlayerConfig.loadSettings();
                settings.defaultQuality = 'auto';
                PlayerConfig.saveSettings(settings);
            }
        } else {
            // Set manual quality
            hls.currentLevel = levelIndex;
            const selectedLevel = levels[levelIndex];
            const quality = `${selectedLevel.height}p - ${Math.round(selectedLevel.bitrate / 1000)} kbps`;
            console.log(`HLS quality switched to: ${quality}`);

            // Save preference
            if (typeof PlayerConfig !== 'undefined') {
                const settings = PlayerConfig.loadSettings();
                settings.defaultQuality = selectedLevel.height;
                PlayerConfig.saveSettings(settings);
                console.log(`Quality preference saved: ${selectedLevel.height}p`);
            }

            // Show notification
            showQualityChangeNotification(quality);
        }
    });

    // Add current quality indicator
    hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        const currentLevel = levels[data.level];
        const quality = currentLevel.height ? `${currentLevel.height}p` : 'Unknown';
        console.log(`Playing at: ${quality} (${Math.round(currentLevel.bitrate / 1000)} kbps)`);
    });

    console.log('HLS quality selector setup complete with', levels.length, 'levels');
}

// Load video with HLS.js for HLS streams
function loadVideoWithHLS(url, startTime = 0) {
    console.log('Loading HLS stream:', url);
    console.log('Start time:', startTime);

    const container = document.getElementById('videoContainer');

    // Cleanup existing HLS instance
    cleanupHLS();

    // Clear container completely (removes conversion loading)
    container.innerHTML = '';

    // Create video element
    const video = document.createElement('video');
    video.controls = true;
    video.controlsList = 'nodownload';
    video.playsInline = true;
    video.preload = 'metadata';
    video.style.width = '100%';
    video.style.height = '100%';

    container.appendChild(video);

    // Initialize YouTube Player (handles all controls, overlays, etc.)
    initializeYouTubePlayer(video, container);

    // Check if HLS is supported
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        console.log('HLS.js is supported, initializing...');

        // Create HLS instance with config
        hlsInstance = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 600,
            maxBufferSize: 60 * 1000 * 1000,
            maxBufferHole: 0.5,
        });

        // Load source
        hlsInstance.loadSource(url);
        hlsInstance.attachMedia(video);

        // HLS events
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
            console.log('HLS manifest loaded, found', data.levels.length, 'quality levels');

            // Log available qualities
            data.levels.forEach((level, index) => {
                console.log(`  Level ${index}: ${level.height}p - ${Math.round(level.bitrate / 1000)} kbps`);
            });

            // Add quality selector if multiple levels available
            // BUT skip if we're using Kuramadrive quality selector (multi-quality HLS)
            const hasKuramaDriveSelector = availableQualities.length > 0;
            if (data.levels.length > 1 && !hasKuramaDriveSelector) {
                console.log('Setting up HLS internal quality selector');
                setupHLSQualitySelector(data.levels, hlsInstance);
            } else if (hasKuramaDriveSelector) {
                console.log('Skipping HLS internal quality selector - using Kuramadrive multi-quality selector');
            }

            console.log('HLS ready, video should start playing...');
            // YouTube player handles loading states automatically

            // Set start time if provided
            if (startTime > 0) {
                video.currentTime = startTime;
                console.log('Set video time to:', startTime);
            }
        });

        hlsInstance.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS error:', data);
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.error('Fatal network error, trying to recover...');
                        hlsInstance.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.error('Fatal media error, trying to recover...');
                        hlsInstance.recoverMediaError();
                        break;
                    default:
                        console.error('Fatal error, cannot recover');
                        cleanupHLS();
                        showError('Failed to load HLS stream. Try another server.');
                        break;
                }
            }
        });

        hlsInstance.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
            console.log('Quality switched to level', data.level);
        });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari, iOS)
        console.log('Using native HLS support');
        video.src = url;

        video.addEventListener('loadedmetadata', () => {
            console.log('Video metadata loaded (native HLS)');
            // YouTube player handles loading states

            if (startTime > 0) {
                video.currentTime = startTime;
                console.log('Set video time to:', startTime);
            }
        });
    } else {
        console.error('HLS is not supported in this browser');
        showError('HLS streaming is not supported in this browser. Please try another browser or server.');
        return;
    }

    // Apply playback speed options from settings
    if (playerSettings?.playbackSpeeds && playerSettings.playbackSpeeds.length > 0) {
        const speedControl = document.getElementById('speedControl');
        const speedSelect = document.getElementById('speedSelect');

        if (speedControl && speedSelect) {
            speedSelect.innerHTML = '';

            playerSettings.playbackSpeeds.forEach(speed => {
                const option = document.createElement('option');
                option.value = speed;
                option.textContent = `${speed}x`;
                if (speed === 1.0) {
                    option.selected = true;
                }
                speedSelect.appendChild(option);
            });

            speedControl.style.display = 'flex';

            speedSelect.addEventListener('change', (e) => {
                const speed = parseFloat(e.target.value);
                video.playbackRate = speed;
                console.log('Playback speed changed to:', speed);
            });
        }
    }

    // Get resume position if enabled
    let resumePosition = 0;
    if (playerSettings?.resumable && typeof PlayerConfig !== 'undefined' && currentEpisodeId) {
        resumePosition = PlayerConfig.getResumePosition(currentEpisodeId);
        if (resumePosition > 0) {
            console.log('Resume position found:', resumePosition);
            startTime = resumePosition;

            setTimeout(() => {
                showResumeNotification(resumePosition);
            }, 1000);
        }
    }

    // Save resume position periodically
    if (playerSettings?.resumable && typeof PlayerConfig !== 'undefined' && currentEpisodeId) {
        video.addEventListener('timeupdate', () => {
            const currentTime = video.currentTime;
            const duration = video.duration;

            if (currentTime > 0 && duration - currentTime > 30 && Math.floor(currentTime) % 5 === 0) {
                PlayerConfig.saveResumePosition(currentEpisodeId, currentTime);
            }
        });

        video.addEventListener('ended', () => {
            PlayerConfig.saveResumePosition(currentEpisodeId, 0);
        });
    }

    // Handle errors
    video.addEventListener('error', (e) => {
        console.error('Video error:', e);
        showError('Failed to load video. Try another server or quality.');
    });

    // Log when video starts playing
    video.addEventListener('playing', () => {
        console.log('HLS video is playing');
    });
}

// Load direct video
function loadVideo(sources, startTime = 0) {
    const container = document.getElementById('videoContainer');

    console.log('Loading video with', sources.length, 'sources');
    console.log('Start time:', startTime);

    // Cleanup any existing HLS instance first
    cleanupHLS();

    // Check if this is an HLS stream (single source with .m3u8)
    if (sources.length === 1 && isHLSStream(sources[0].url)) {
        console.log('Detected HLS stream, using HLS player');
        loadVideoWithHLS(sources[0].url, startTime);
        return;
    }

    // Store overlay elements
    const loadingOverlay = container.querySelector('.loading-overlay');
    const skipControls = container.querySelector('.video-skip-controls');
    const skipFeedback = container.querySelector('.skip-feedback');

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
    // Sources are sorted lowest to highest (360p, 480p, 720p, 1080p)
    // Browser will auto-select first source (lowest) for fast initial load
    // Other qualities are available for user selection without re-download
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

    // Initialize YouTube Player
    initializeYouTubePlayer(video, container);

    // Apply playback speed options from settings
    if (playerSettings?.playbackSpeeds && playerSettings.playbackSpeeds.length > 0) {
        const speedControl = document.getElementById('speedControl');
        const speedSelect = document.getElementById('speedSelect');

        if (speedControl && speedSelect) {
            // Clear existing options
            speedSelect.innerHTML = '';

            // Add speed options from settings
            playerSettings.playbackSpeeds.forEach(speed => {
                const option = document.createElement('option');
                option.value = speed;
                option.textContent = `${speed}x`;
                if (speed === 1.0) {
                    option.selected = true;
                }
                speedSelect.appendChild(option);
            });

            // Show speed control
            speedControl.style.display = 'flex';

            // Handle speed change
            speedSelect.addEventListener('change', (e) => {
                const speed = parseFloat(e.target.value);
                video.playbackRate = speed;
                console.log('Playback speed changed to:', speed);
            });

            console.log('Playback speeds loaded:', playerSettings.playbackSpeeds);
        }
    }

    // Get resume position if enabled
    let resumePosition = 0;
    if (playerSettings?.resumable && typeof PlayerConfig !== 'undefined' && currentEpisodeId) {
        resumePosition = PlayerConfig.getResumePosition(currentEpisodeId);
        if (resumePosition > 0) {
            console.log('Resume position found:', resumePosition);
            startTime = resumePosition;

            // Show resume notification
            setTimeout(() => {
                showResumeNotification(resumePosition);
            }, 1000);
        }
    }

    // Set start time and play
    video.addEventListener('loadedmetadata', () => {
        console.log('Video metadata loaded');
        if (startTime > 0) {
            video.currentTime = startTime;
            console.log('Set video time to:', startTime);
        }
        hideLoading();
    });

    // Save resume position periodically
    if (playerSettings?.resumable && typeof PlayerConfig !== 'undefined' && currentEpisodeId) {
        video.addEventListener('timeupdate', () => {
            const currentTime = video.currentTime;
            const duration = video.duration;

            // Save position every 5 seconds, but not in last 30 seconds
            if (currentTime > 0 && duration - currentTime > 30 && Math.floor(currentTime) % 5 === 0) {
                PlayerConfig.saveResumePosition(currentEpisodeId, currentTime);
            }
        });

        // Clear resume position when video ends
        video.addEventListener('ended', () => {
            PlayerConfig.saveResumePosition(currentEpisodeId, 0);
        });
    }

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

    // Clear container except loading overlay
    const loadingOverlay = container.querySelector('.loading-overlay');
    const skipControls = container.querySelector('.video-skip-controls');
    const skipFeedback = container.querySelector('.skip-feedback');

    container.innerHTML = '';

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.allowFullscreen = true;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';

    container.appendChild(iframe);

    // Re-append overlay elements
    if (loadingOverlay) container.appendChild(loadingOverlay);
    if (skipControls) container.appendChild(skipControls);
    if (skipFeedback) container.appendChild(skipFeedback);

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

// Show conversion loading with message
function showConversionLoading() {
    const container = document.getElementById('videoContainer');
    container.innerHTML = `
        <div class="loading-overlay" style="display: flex; flex-direction: column; gap: 15px;">
            <div class="spinner"></div>
            <div style="text-align: center; color: #fff;">
                <p style="font-size: 1.1rem; font-weight: 600; margin: 0;">Mengkonversi Video...</p>
                <p style="font-size: 0.85rem; color: #999; margin: 5px 0 0 0;">
                    Video sedang didownload dan dikonversi ke format HLS.<br>
                    Mohon tunggu beberapa saat...
                </p>
            </div>
        </div>
    `;
}

// Hide loading overlay
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        console.log('Hiding loading overlay');
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);
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
        window.location.href = `/v3/episode?animeId=${animeId}&slug=${slug}&episode=${episode}`;
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

    // Detail page - convert to internal detail page
    if (episodeData.anime_detail_url) {
        const detailUrl = convertToDetailUrl(episodeData.anime_detail_url);
        detailBtn.href = detailUrl;
        detailBtn.removeAttribute('target'); // Open in same tab
    }
}

// Convert original URL to player URL
function convertToPlayerUrl(url) {
    const match = url.match(/\/anime\/(\d+)\/([^\/]+)\/episode\/(\d+)/);
    if (match) {
        const [, animeId, slug, episode] = match;
        return `/v3/episode?animeId=${animeId}&slug=${slug}&episode=${episode}`;
    }
    return url;
}

// Convert original URL to detail page URL
function convertToDetailUrl(url) {
    // Match pattern: /anime/{animeId}/{slug}
    const match = url.match(/\/anime\/(\d+)\/([^\/\?]+)/);
    if (match) {
        const [, animeId, slug] = match;
        return `/v3/detail?animeId=${animeId}&slug=${slug}`;
    }
    return url;
}

// Skip video functions
function skipVideo(seconds) {
    const video = document.querySelector('#videoContainer video');
    if (!video) return;

    const newTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    video.currentTime = newTime;

    // Show feedback
    showSkipFeedback(seconds);
}

function showSkipFeedback(seconds) {
    const feedback = document.getElementById('skipFeedback');
    if (!feedback) return;

    const direction = seconds > 0 ? 'forward' : 'backward';
    const absSeconds = Math.abs(seconds);
    const arrow = seconds > 0 ? '→' : '←';

    feedback.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
            ${seconds > 0 ?
            '<path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>' :
            '<path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>'
        }
        </svg>
        ${absSeconds} detik ${arrow}
    `;

    feedback.classList.add('show');

    setTimeout(() => {
        feedback.classList.remove('show');
    }, 800);
}

// Check if device is desktop
function isDesktop() {
    return window.innerWidth > 768;
}

// Format time in HH:MM:SS or MM:SS format
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        // Format: H:MM:SS for videos longer than 1 hour
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        // Format: MM:SS for videos shorter than 1 hour
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Show resume notification
function showResumeNotification(position) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        animation: fadeInOut 4s ease-in-out;
    `;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
            <span>Melanjutkan dari ${formatTime(position)}</span>
        </div>
    `;

    // Add animation CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInOut {
            0%, 100% { opacity: 0; }
            10%, 90% { opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
        style.remove();
    }, 4000);
}

// Show quality change notification
function showQualityChangeNotification(quality) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        animation: fadeInOut 3s ease-in-out;
    `;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
            </svg>
            <span>Quality: ${quality}</span>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    fetchEpisodeData();
});

// Cleanup HLS instance and all sessions when page unloads
window.addEventListener('beforeunload', () => {
    // Close all HLS sessions (all qualities)
    if (allHLSSessions.length > 0) {
        console.log('Page unload: Cleaning up', allHLSSessions.length, 'HLS session(s)');

        // Use sendBeacon for reliable cleanup on page unload
        allHLSSessions.forEach(sessionId => {
            const url = `/api/hls/close/${sessionId}`;
            const data = JSON.stringify({});

            // sendBeacon is more reliable than fetch for beforeunload
            if (navigator.sendBeacon) {
                navigator.sendBeacon(url, data);
            } else {
                // Fallback for older browsers
                fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    keepalive: true
                }).catch(console.error);
            }
        });
    }

    cleanupHLS();
});

// Also cleanup on visibility change (tab close, switch)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && currentHLSSession) {
        console.log('Page hidden, session will auto-cleanup after timeout');
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Prevent shortcuts when typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }

    const video = document.querySelector('#videoContainer video');

    // Space = play/pause
    if (e.code === 'Space') {
        e.preventDefault();
        if (video) {
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        }
    }

    // Desktop: Arrow keys for skip 10 seconds (if enabled in settings)
    // Mobile: Arrow keys for previous/next episode
    if (isDesktop()) {


        // Desktop: Shift + Arrow for previous/next episode
        if (e.shiftKey && e.code === 'ArrowLeft' && episodeData?.navigation.prev_episode) {
            e.preventDefault();
            window.location.href = convertToPlayerUrl(episodeData.navigation.prev_episode);
        }

        if (e.shiftKey && e.code === 'ArrowRight' && episodeData?.navigation.next_episode) {
            e.preventDefault();
            window.location.href = convertToPlayerUrl(episodeData.navigation.next_episode);
        }
    } else {
        // Mobile: Arrow keys for episode navigation (original behavior)
        if (e.code === 'ArrowLeft' && episodeData?.navigation.prev_episode) {
            window.location.href = convertToPlayerUrl(episodeData.navigation.prev_episode);
        }

        if (e.code === 'ArrowRight' && episodeData?.navigation.next_episode) {
            window.location.href = convertToPlayerUrl(episodeData.navigation.next_episode);
        }
    }



    // K = play/pause (YouTube style)
    if (e.code === 'KeyK' && video) {
        e.preventDefault();
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    }
});

// Main server selector handler
const mainServerSelect = document.getElementById('mainServerSelect');
if (mainServerSelect) {
    mainServerSelect.addEventListener('change', (e) => {
        const selectedVersion = e.target.value;
        const versionMap = {
            v1: '/v1/home',
            v2: '/v2/home',
            v3: '/v3/home',
            v4: '/v4/home',
            v5: '/v5/home',
            v6: '/v6/home',
            v7: '/v7/home'
        };

        const targetPath = versionMap[selectedVersion];
        if (targetPath) {
            window.location.href = targetPath;
        }
    });
}
