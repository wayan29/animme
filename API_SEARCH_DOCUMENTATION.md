# AnimMe Search API Documentation

## Overview
AnimMe provides 3 separate search APIs, each with its own data source, URL structure, and response format.

---

## API v1 (Otakudesu)
**Base URL:** `/api/`
**Source:** Otakudesu (https://otakudesu.best)
**Status:** ⚠️ **Blocked by Cloudflare** (HTTP 403)

### Endpoint
```
GET /api/search/:keyword
```

### Example
```bash
curl http://localhost:5000/api/search/naruto
```

### Response Format
```json
{
  "status": "success",
  "data": [
    {
      "title": "Naruto",
      "slug": "naruto",
      "poster": "/img/hash123",
      "genres": [
        { "name": "Action" },
        { "name": "Adventure" }
      ],
      "status": "Completed",
      "rating": "8.5"
    }
  ]
}
```

### Status
- **Cloudflare Protection:** YES (Blocks automated requests)
- **Solution:** Currently unavailable - needs browser rendering or proxy service
- **Alternative:** Use `/api/v3/kuramanime/search`

---

## API v2 (Samehadaku)
**Base URL:** `/api/`
**Source:** Samehadaku (https://samehadaku.website)
**Status:** ⚠️ **Blocked by Cloudflare** (HTTP 403)

### Endpoint
```
GET /api/v2/search/:keyword
```

### Example
```bash
curl http://localhost:5000/api/v2/search/naruto
```

### Response Format
```json
{
  "status": "success",
  "data": [
    {
      "title": "Naruto",
      "slug": "naruto",
      "poster": "/img/hash456",
      "genres": [],
      "status": "",
      "rating": ""
    }
  ]
}
```

### Status
- **Cloudflare Protection:** YES (Blocks automated requests)
- **Solution:** Currently unavailable - needs browser rendering or proxy service
- **Alternative:** Use `/api/v3/kuramanime/search`

---

## API v3 (Kuramanime)
**Base URL:** `/api/v3/kuramanime/`
**Source:** Kuramanime (https://kuramanime.com)
**Status:** ✅ **WORKING** (No Cloudflare protection)

### Search Endpoint
```
GET /api/v3/kuramanime/search?q=query&page=1&order_by=ascending
```

### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | required | Search query (anime title) |
| `page` | integer | 1 | Page number for pagination |
| `order_by` | string | ascending | Sort order: `ascending` or `descending` |

### Example
```bash
# Simple search
curl "http://localhost:5000/api/v3/kuramanime/search?q=naruto"

# With pagination and sorting
curl "http://localhost:5000/api/v3/kuramanime/search?q=naruto&page=1&order_by=descending"
```

### Response Format
```json
{
  "status": "success",
  "data": {
    "results": [
      {
        "anime_id": "185",
        "slug": "naruto",
        "title": "Naruto",
        "poster": "/img/bd79832d01dea4bb1fc46d84a5e3dae6",
        "rating": "7.97",
        "status": "SELESAI",
        "tags": [
          {
            "label": "TV",
            "url": "https://kuramanime.com/properties/type/TV"
          },
          {
            "label": "BD",
            "url": "https://kuramanime.com/properties/quality/BD"
          }
        ],
        "anime_url": "https://kuramanime.com/anime/185/naruto"
      }
    ]
  }
}
```

### Status
- **Cloudflare Protection:** NO ✅
- **Working:** YES ✅
- **Available:** ALWAYS ✅

---

## Comparison Table

| Feature | V1 (Otakudesu) | V2 (Samehadaku) | V3 (Kuramanime) |
|---------|---|---|---|
| **Endpoint** | `/api/search/:keyword` | `/api/v2/search/:keyword` | `/api/v3/kuramanime/search?q=...` |
| **Status** | ⚠️ Blocked (Cloudflare) | ⚠️ Blocked (Cloudflare) | ✅ Working |
| **Data Fields** | title, slug, poster, genres, status, rating | title, slug, poster | title, slug, poster, genres (tags), status, rating, anime_id |
| **Genre Info** | ✅ Full details | ❌ Empty | ✅ As tags (label + url) |
| **Pagination** | Via page param | Via page param | Via page & order_by params |
| **Reliability** | Low | Low | High |

---

## Recommendations

### For Frontend Implementation
**Use API v3 (Kuramanime)** for best reliability:
- No Cloudflare blocks
- Consistent availability
- Rich metadata (ratings, status, tags)
- Pagination support

### If You Need V1/V2 Data
1. **Option A:** Use premium proxy service (Bright Data, Smartproxy)
2. **Option B:** Run server with Puppeteer + full dependencies (resource intensive)
3. **Option C:** Use V3 Kuramanime instead

---

## API Endpoint Structure Summary

```
/api/search/:keyword              → V1 (Otakudesu) - BLOCKED
/api/v2/search/:keyword           → V2 (Samehadaku) - BLOCKED
/api/v3/kuramanime/search         → V3 (Kuramanime) - WORKING ✅
/api/v3/kuramanime/...            → Other V3 endpoints
```

---

## Error Handling

### V1/V2 Search Errors
```json
{
  "status": "error",
  "message": "Request failed with status code 403",
  "note": "Otakudesu (V1) is protected by Cloudflare. Try /api/v2/search or /api/v3/kuramanime/search"
}
```

### V3 Search Success
```json
{
  "status": "success",
  "data": { "results": [...] }
}
```

---

## Why APIs Are Separate

Each API maintains separate implementations because:
1. **Different Base URLs** - Different source websites
2. **Different HTML Selectors** - Different page structures
3. **Different Response Formats** - Different data structures
4. **Different Limitations** - Some have Cloudflare, others don't
5. **User Choice** - Users can specify which source they prefer

This separation ensures clarity and prevents masking individual API issues.
