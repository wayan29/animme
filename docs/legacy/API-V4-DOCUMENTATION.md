# API V4 Documentation - Anichin.cafe

## Overview
API V4 menyediakan akses ke data dari website Anichin.cafe (Fansub Donghua Subtitle Indonesia).

## Base URL
```
http://localhost:5000/api/v4/anichin/
```

## Available Endpoints

### 1. Homepage (Complete Data)
**GET** `/api/v4/anichin/home`

Mengambil semua data homepage dalam satu request.

**Response:**
```json
{
  "status": "success",
  "data": {
    "banner_recommendations": [...],
    "popular_today": [...],
    "latest_releases": [...],
    "total_banners": 14,
    "total_popular": 0,
    "total_latest": 0
  }
}
```

### 2. Banner Recommendations
**GET** `/api/v4/anichin/banner-recommendations`

Mengambil data banner rekomendasi dari slider homepage.

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "title": "Soul Land Season 2",
      "japanese_title": "Soul Land Season 2",
      "slug": "soul-land-season-2",
      "url": "https://anichin.cafe/seri/soul-land-season-2/",
      "backdrop": "https://i0.wp.com/anichin.cafe/wp-content/uploads/2023/06/Soul-Land-2-Cover.jpg",
      "description": "Season ke 2 dari Donghua Soul Land...",
      "watch_url": "https://anichin.cafe/seri/soul-land-season-2/",
      "type": "banner"
    }
  ],
  "total": 14
}
```

### 3. Popular Today
**GET** `/api/v4/anichin/popular-today`

Mengambil data anime populer hari ini.

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "title": "Renegade Immortal",
      "slug": "renegade-immortal",
      "url": "https://anichin.cafe/renegade-immortal-episode-112-subtitle-indonesia/",
      "poster": "https://anichin.cafe/wp-content/uploads/2023/09/Renegade-Immortal-sub-indo.webp",
      "episode": "Episode 112",
      "type": "Donghua",
      "category": "popular_today"
    }
  ],
  "total": 5
}
```

### 4. Latest Releases
**GET** `/api/v4/anichin/latest-releases`

Mengambil data rilisan terbaru.

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "title": "Throne of Seal",
      "slug": "throne-of-seal",
      "url": "https://anichin.cafe/throne-of-seal-episode-183-subtitle-indonesia/",
      "poster": "https://anichin.cafe/wp-content/uploads/2022/04/throne-of-seal-sub-indo.webp",
      "episode": "Episode 183",
      "type": "Donghua",
      "category": "latest_release"
    }
  ],
  "total": 20
}
```

### 5. Anime Detail
**GET** `/api/v4/anichin/detail/:slug`

Mengambil detail anime berdasarkan slug.

**Parameters:**
- `slug` - Slug dari anime (contoh: `soul-land-season-2`)

**Response:**
```json
{
  "status": "success",
  "data": {
    "title": "Anime Title",
    "alternative_title": "Japanese Title",
    "slug": "anime-slug",
    "poster": "poster_url",
    "description": "Anime description",
    "info": {...},
    "episodes": [...],
    "total_episodes": 12
  }
}
```

## Data Structure

### Banner Recommendation Object
```json
{
  "title": "string",
  "japanese_title": "string", 
  "slug": "string",
  "url": "string",
  "backdrop": "string",
  "description": "string",
  "watch_url": "string",
  "type": "banner"
}
```

### Popular/Latest Object
```json
{
  "title": "string",
  "slug": "string",
  "url": "string",
  "poster": "string",
  "episode": "string",
  "type": "string",
  "category": "popular_today|latest_release"
}
```

## Error Handling

**Error Response:**
```json
{
  "status": "error",
  "message": "Error description",
  "data": []
}
```

## Usage Examples

### JavaScript/Fetch
```javascript
// Get banner recommendations
fetch('http://localhost:5000/api/v4/anichin/banner-recommendations')
  .then(response => response.json())
  .then(data => console.log(data));

// Get anime detail
fetch('http://localhost:5000/api/v4/anichin/detail/soul-land-season-2')
  .then(response => response.json())
  .then(data => console.log(data));
```

### cURL
```bash
# Get homepage data
curl http://localhost:5000/api/v4/anichin/home

# Get banner recommendations
curl http://localhost:5000/api/v4/anichin/banner-recommendations

# Get anime detail
curl http://localhost:5000/api/v4/anichin/detail/soul-land-season-2
```

## Notes
- API V4 saat ini berhasil mengambil semua data:
  - Banner recommendations (14 items)
  - Popular today (5 items)
  - Latest releases (20 items)
- Server berjalan di port 5000
- CORS di-enable untuk cross-origin requests
- Rate limiting belum diimplementasikan

## Status
- ✅ Banner Recommendations - Working (14 items)
- ✅ Popular Today - Working (5 items)
- ✅ Latest Releases - Working (20 items)
- ✅ Anime Detail - Implemented
- ✅ Homepage - Working
