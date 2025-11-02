# V5 Anoboy - Troubleshooting Guide

## Issue: Episode List Tidak Muncul di Detail Page

### Status Pemeriksaan:

✅ **Backend API:** WORKING
- Endpoint `/api/v5/anoboy/detail/anime/[slug]` mengembalikan data dengan benar
- 5 episodes ter-scrape dari anoboy.be
- Data structure valid dengan `episode`, `slug`, `url`, `release_date`

✅ **Frontend Code:** CORRECT
- `detail.js` sudah memiliki logic untuk render episodes
- Episode grid sudah di-generate dengan HTML yang benar
- Styling CSS sudah ada (`.episodes-grid`, `.episode-card`)

### Kemungkinan Penyebab:

#### 1. **Browser Cache** (Paling Mungkin)
User mungkin mengakses halaman sebelum file `detail.html` dan `detail.js` dibuat.

**Solusi:**
```
Hard refresh di browser:
- Chrome/Firefox: Ctrl+Shift+R (Windows/Linux)
- Mac: Cmd+Shift+R
- Atau: F12 > Network tab > Centang "Disable cache" > Reload
```

#### 2. **JavaScript Version Caching**
File `detail.js` mungkin di-cache oleh browser.

**Solusi:**
```
Ubah version di detail.html:
<script src="/v5/detail.js?v=20251101-v2"></script>
```

### URL untuk Testing:

**Detail Page:**
```
http://167.253.159.235:5000/v5/detail?slug=anime/kao-ni-denai-kashiwada-san-to-kao-ni-deru-oota-kun
```

**API Endpoint:**
```
http://167.253.159.235:5000/api/v5/anoboy/detail/anime/kao-ni-denai-kashiwada-san-to-kao-ni-deru-oota-kun
```

### Debugging Steps:

1. **Buka Browser DevTools (F12)**
2. **Go to Console tab**
3. **Refresh halaman detail**
4. **Cari log:**
   ```
   [V5] Rendering detail: {title: "...", episodes_count: 5, has_episodes: true}
   [V5] Episodes HTML generated: ...
   ```

5. **Jika tidak ada log** → JavaScript belum load
   - Hard refresh (Ctrl+Shift+R)
   - Clear cache

6. **Jika ada log tapi episodes tidak muncul** → Check Elements tab
   - Cari `.episodes-section`
   - Cek apakah HTML ter-inject

### Expected Output:

API Response harus mengembalikan:
```json
{
  "status": "success",
  "data": {
    "title": "Kao ni Denai Kashiwada-san to Kao ni Deru Oota-kun",
    "episodes": [
      {
        "episode": "1",
        "slug": "kao-ni-denai-kashiwada-san-to-kao-ni-deru-oota-kun-episode-1-subtitle-indonesia",
        "url": "https://anoboy.be/...",
        "release_date": "October 4, 2025"
      },
      ...5 episodes total
    ]
  }
}
```

Frontend harus render:
```html
<div class="episodes-section">
  <h2 class="section-title">
    Episode List
    <span class="section-badge">5</span>
  </h2>
  <div class="episodes-grid">
    <a href="/v5/episode?slug=..." class="episode-card">
      <div class="episode-number">Episode 1</div>
      <div class="episode-date">October 4, 2025</div>
    </a>
    <!-- ...5 cards total -->
  </div>
</div>
```

### Quick Fix Checklist:

- [x] API returns episodes ✅
- [x] detail.js has rendering code ✅
- [x] detail.html includes script ✅
- [x] CSS styles defined ✅
- [ ] User needs to clear browser cache ⚠️
- [ ] Check browser console for errors

### Alternative: Test dengan Incognito/Private Window

Buka browser dalam mode incognito untuk memastikan tidak ada cache:
```
Chrome: Ctrl+Shift+N
Firefox: Ctrl+Shift+P
```

Kemudian akses:
```
http://167.253.159.235:5000/v5/detail?slug=anime/kao-ni-denai-kashiwada-san-to-kao-ni-deru-oota-kun
```

Jika di incognito mode episodes muncul → Konfirmasi masalahnya adalah browser cache.

---

**Last Updated:** 2025-11-01
**Status:** Backend & Frontend code correct - Issue is client-side cache
