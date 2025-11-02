# V5 Episode Link Fix

## Issue
User melaporkan: "perbaiki yang di /v5/home jika saya klik salah satu anime, malah ke detail anime harusnya detail episode."

## Root Cause
Di homepage V5, **Latest Releases** menampilkan episode terbaru, tetapi ketika diklik link mengarah ke halaman detail anime (`/v5/detail`) bukan halaman episode (`/v5/episode`).

**Before (public/v5/app.js line 127):**
```javascript
function createAnimeCard(anime) {
    const link = document.createElement('a');
    link.className = 'anime-card';
    link.href = anime.slug ? `/v5/detail?slug=${encodeURIComponent(anime.slug)}` : '#';
    // ...
}
```

Ini selalu mengarah ke `/v5/detail` tanpa membedakan apakah itu episode atau anime.

## Solution
Update fungsi `createAnimeCard()` untuk auto-detect berdasarkan field `episode`:
- **Jika ada field `episode`** (Latest Release) → link ke `/v5/episode`
- **Jika tidak ada field `episode`** (Recommendation) → link ke `/v5/detail`

**After:**
```javascript
function createAnimeCard(anime) {
    const link = document.createElement('a');
    link.className = 'anime-card';

    // Determine link destination: if has episode field, it's an episode; otherwise it's anime detail
    if (anime.slug) {
        if (anime.episode) {
            // Latest release episode - link to episode page
            link.href = `/v5/episode?slug=${encodeURIComponent(anime.slug)}`;
        } else {
            // Recommendation or anime - link to detail page
            link.href = `/v5/detail?slug=${encodeURIComponent(anime.slug)}`;
        }
    } else {
        link.href = '#';
    }
    // ...
}
```

## How It Works

### Latest Releases Section
**Data dari API:**
```json
{
  "title": "Uma Musume: Cinderella Gray Part 2 Episode 4 Subtitle Indonesia",
  "slug": "uma-musume-cinderella-gray-part-2-episode-4-subtitle-indonesia",
  "episode": "Episode 4",  // <-- Field episode ada
  "type": "TV"
}
```

**Generated Link:**
```
/v5/episode?slug=uma-musume-cinderella-gray-part-2-episode-4-subtitle-indonesia
```
✅ Langsung ke halaman streaming episode

### Recommendations Section
**Data dari API:**
```json
{
  "title": "Tondemo Skill de Isekai Hourou Meshi 2",
  "slug": "tondemo-skill-de-isekai-hourou-meshi-2",
  // No episode field
  "type": "TV",
  "score": "8.5"
}
```

**Generated Link:**
```
/v5/detail?slug=tondemo-skill-de-isekai-hourou-meshi-2
```
✅ Ke halaman detail anime (menampilkan list episode)

## Testing

### Test 1: Latest Release Click
1. Buka `/v5/home`
2. Klik salah satu card dari section **Latest Release**
3. Seharusnya langsung ke halaman streaming episode ✅

### Test 2: Recommendation Click
1. Buka `/v5/home`
2. Scroll ke section **Recommendation** (jika sudah diimplementasikan di frontend)
3. Klik salah satu card
4. Seharusnya ke halaman detail anime (list episode) ✅

## Impact
- ✅ Latest Release → Langsung ke halaman episode (streaming)
- ✅ Recommendation → Ke halaman detail anime (list episode)
- ✅ User experience lebih baik (tidak perlu klik 2x untuk nonton episode)

## Files Modified
- `public/v5/app.js` (lines 123-160): Updated `createAnimeCard()` function

## Notes
- Ini adalah perubahan frontend JavaScript, tidak perlu restart server
- User cukup refresh browser untuk melihat perubahan
- Logika detection otomatis berdasarkan field `episode`, jadi tetap flexible untuk future changes

## Status
✅ **FIXED** - Link sekarang otomatis mendeteksi episode vs anime
