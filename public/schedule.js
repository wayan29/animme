const API_BASE = '/api';

async function fetchSchedule() {
    try {
        const response = await fetch(`${API_BASE}/schedule`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching schedule:', error);
        return null;
    }
}

function displaySchedule(scheduleData) {
    const container = document.getElementById('scheduleContainer');
    
    if (!scheduleData || !scheduleData.data) {
        container.innerHTML = '<div class="error">Gagal memuat jadwal rilis</div>';
        return;
    }

    const daysOrder = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu', 'Random'];
    
    // Convert object to array and sort
    const scheduleArray = Object.entries(scheduleData.data).map(([day, animeList]) => ({
        day: day,
        anime_list: animeList
    }));
    
    const sortedData = scheduleArray.sort((a, b) => {
        return daysOrder.indexOf(a.day) - daysOrder.indexOf(b.day);
    });

    container.innerHTML = sortedData.map(daySchedule => {
        const animeCount = daySchedule.anime_list ? daySchedule.anime_list.length : 0;
        
        return `
            <div class="schedule-day-section">
                <div class="schedule-day-header">
                    <h3 class="schedule-day-title">${daySchedule.day}</h3>
                    <span class="schedule-day-count">${animeCount} Anime</span>
                </div>
                <div class="schedule-anime-list">
                    ${daySchedule.anime_list && daySchedule.anime_list.length > 0 
                        ? daySchedule.anime_list.map(anime => `
                            <div class="schedule-anime-item" onclick="goToDetail('${anime.slug}')">
                                <div class="schedule-anime-title">${anime.title}</div>
                                <div class="schedule-anime-arrow">→</div>
                            </div>
                        `).join('')
                        : '<div class="no-anime">Tidak ada anime</div>'
                    }
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

async function loadSchedulePage() {
    const data = await fetchSchedule();
    console.log('Schedule data:', data);
    if (data && data.data) {
        console.log('Displaying schedule with', Object.keys(data.data).length, 'days');
        displaySchedule(data);
    } else {
        console.error('No schedule data available');
        const container = document.getElementById('scheduleContainer');
        container.innerHTML = '<div class="error">Gagal memuat jadwal rilis</div>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadSchedulePage();
});
