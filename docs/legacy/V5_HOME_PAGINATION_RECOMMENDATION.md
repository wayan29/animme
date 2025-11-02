# V5 Home - Pagination & Recommendation Implementation

## Overview
Menambahkan fitur pagination (tombol Next) dan section Recommendation di homepage V5 (Anoboy).

## User Request
> "di menu home ada tombol next di https://anoboy.be/ , ambil juga Recommendation"

## Implementation Summary

### Backend Changes

#### 1. File: `server/anoboy/home.js`

**Updated `scrapeLatestReleases()`:**
- Menggunakan `.listupd.first()` untuk hanya ambil section Latest Release (section pertama)
- Fix title duplication dengan h2 selector
- Update pagination detection menggunakan `.hpage a.r` selector
- Menambahkan `next_page_url` di response pagination

**Added `scrapeRecommendation()`:**
- Scrape section kedua (`.listupd.eq(1)`)
- Extract anime recommendation dengan h2 selector (avoid duplication)
- Return array of 20 anime recommendations

**Updated `scrapeHomepage()`:**
- Menerima parameter `page`
- Memanggil `scrapeLatestReleases(page)` dan `scrapeRecommendation()` parallel
- Recommendation hanya dimuat di page 1
- Return structure baru dengan `latest_releases` dan `recommendations`

#### 2. File: `server/anoboy/index.js`
- Added import: `scrapeRecommendation`
- Added export: `scrapeRecommendation`

#### 3. File: `server/server.js` - API Endpoint
Updated `/api/v5/anoboy/home`:
```javascript
app.get('/api/v5/anoboy/home', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const data = await anoboyScraper.scrapeHomepage(page);
    res.json(data);
});
```

### API Response Structure

**Page 1:**
```json
{
  "status": "success",
  "data": {
    "latest_releases": [
      {
        "title": "Uma Musume: Cinderella Gray Part 2 Episode 4 Subtitle Indonesia",
        "slug": "uma-musume-cinderella-gray-part-2-episode-4-subtitle-indonesia",
        "url": "https://anoboy.be/...",
        "poster": "/image-proxy/...",
        "episode": "Episode 4",
        "type": "TV"
      }
      // ... 19 more items
    ],
    "recommendations": [
      {
        "title": "Tondemo Skill de Isekai Hourou Meshi 2",
        "slug": "tondemo-skill-de-isekai-hourou-meshi-2",
        "url": "https://anoboy.be/...",
        "poster": "/image-proxy/...",
        "type": "TV",
        "score": "8.5"
      }
      // ... 19 more items
    ],
    "pagination": {
      "current_page": 1,
      "has_next_page": true,
      "has_previous_page": false,
      "next_page_url": "https://anoboy.be/page/2/"
    }
  }
}
```

**Page 2+:**
```json
{
  "status": "success",
  "data": {
    "latest_releases": [ /* 20 items */ ],
    "recommendations": [],  // Empty on page 2+
    "pagination": {
      "current_page": 2,
      "has_next_page": true,
      "has_previous_page": true,
      "next_page_url": "https://anoboy.be/page/3/"
    }
  }
}
```

## Frontend Changes (TO DO)

### File: `public/v5/index.html`
**Changes needed:**
1. Add Recommendation section HTML after Latest Release section:
```html
<!-- Recommendation Section -->
<section class="anime-section" id="recommendationSection" style="display: none;">
    <h2 class="section-title">🎯 Recommendation</h2>
    <div class="anime-grid" id="recommendationGrid"></div>
</section>
```

2. Add Pagination controls after Latest Release section:
```html
<!-- Pagination -->
<div class="pagination-container" id="paginationContainer" style="display: none;">
    <button id="nextPageBtn" class="pagination-btn">
        Next Page →
    </button>
</div>
```

### File: `public/v5/app.js` (or inline script)
**Changes needed:**

1. Update loadHomepage() function to handle pagination:
```javascript
async function loadHomepage(page = 1) {
    const data = await fetchAPI(`/home?page=${page}`);

    // Render latest releases
    renderAnimeGrid('latestGrid', data.data.latest_releases);

    // Render recommendations (only on page 1)
    if (page === 1 && data.data.recommendations.length > 0) {
        document.getElementById('recommendationSection').style.display = 'block';
        renderAnimeGrid('recommendationGrid', data.data.recommendations);
    } else {
        document.getElementById('recommendationSection').style.display = 'none';
    }

    // Render pagination
    renderPagination(data.data.pagination, page);
}
```

2. Add renderPagination() function:
```javascript
function renderPagination(pagination, currentPage) {
    const container = document.getElementById('paginationContainer');

    if (pagination.has_next_page) {
        container.style.display = 'block';
        document.getElementById('nextPageBtn').onclick = () => {
            loadHomepage(currentPage + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
    } else {
        container.style.display = 'none';
    }
}
```

## Testing Results

### API Tests
✅ **Page 1:**
```bash
curl "http://localhost:5000/api/v5/anoboy/home?page=1"
# Response:
# - latest_count: 20
# - reco_count: 20
# - has_next_page: true
# - first_latest: "Uma Musume: Cinderella Gray Part 2 Episode 4 Subtitle Indonesia" (CLEAN!)
# - first_reco: "Tondemo Skill de Isekai Hourou Meshi 2"
```

✅ **Title Quality:** No duplication!
- Before: "Uma Musume Uma Musume Episode 4 Subtitle Indonesia"
- After: "Uma Musume: Cinderella Gray Part 2 Episode 4 Subtitle Indonesia" ✓

✅ **Pagination Detection:** Using `.hpage a.r` selector correctly

✅ **Recommendation Section:** 20 anime scraped successfully

## Files Modified

### Backend:
- ✅ `server/anoboy/home.js` - Added recommendation scraper, fixed title duplication, updated pagination
- ✅ `server/anoboy/index.js` - Added scrapeRecommendation export
- ✅ `server/server.js` - Updated homepage API to support page parameter

### Frontend (TODO):
- ⏳ `public/v5/index.html` - Need to add Recommendation section and pagination UI
- ⏳ `public/v5/app.js` (or inline script) - Need to add pagination logic

## Status
✅ **Backend COMPLETE** - API fully functional with pagination and recommendations
⏳ **Frontend PENDING** - Need to update UI to display recommendations and pagination

## Next Steps
1. Update `public/v5/index.html` to add Recommendation section HTML
2. Update frontend JavaScript to render recommendations
3. Add pagination button with page navigation
4. Test complete flow on browser
