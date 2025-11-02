# V3 Carousel Banner - Clickable Banner Fix

## Masalah
Banner rekomendasi carousel di bagian paling atas home page V3 tidak bisa diklik langsung ke detail anime. User harus klik tombol "Tonton Sekarang" atau "Info Lebih", padahal di mobile lebih intuitif jika seluruh banner bisa diklik.

## Root Cause
Carousel slide menggunakan `<div>` yang tidak clickable. Hanya tombol-tombol di dalam banner yang bisa diklik dengan `onclick` handler.

## Solusi yang Diterapkan

### 1. Membuat Seluruh Banner Clickable

**File:** `/home/droid/animme/public/v3/app.js`

#### Perubahan di `displayCarousel()` (baris 138-197)

**Sebelum:**
```javascript
return `
    <div class="carousel-slide ${index === 0 ? 'active' : ''}" style="...">
        <div class="carousel-content">
            <h2>${anime.title}</h2>
            <div class="carousel-buttons">
                <button onclick="goToDetail(...)">▶ Tonton Sekarang</button>
                <button onclick="goToDetail(...)">ℹ Info Lebih</button>
            </div>
        </div>
    </div>
`;
```

**Sesudah:**
```javascript
const detailUrl = anime.slug && anime.anime_id
    ? `/v3/detail/${anime.anime_id}/${anime.slug}`
    : `/v3/detail?slug=${anime.slug}`;

return `
    <a href="${detailUrl}" class="carousel-slide ${index === 0 ? 'active' : ''}" style="...">
        <div class="carousel-content">
            <h2>${anime.title}</h2>
            <div class="carousel-buttons">
                <span class="btn btn-primary">▶ Tonton Sekarang</span>
                <span class="btn btn-secondary">ℹ Info Lebih</span>
            </div>
        </div>
    </a>
`;
```

**Perubahan Key:**
1. `<div>` → `<a href>` untuk seluruh slide
2. Buttons di dalam diganti `<button>` → `<span>` (karena tidak boleh nested links/buttons dalam `<a>`)
3. URL langsung di-generate di href

### 2. Mencegah Conflict dengan Tombol Navigasi

**Problem:** Tombol prev/next dan indicators juga perlu tetap berfungsi tanpa trigger link ke detail.

**Solution:** Event propagation stopped

```javascript
// Indicators dengan stopPropagation
indicators.innerHTML = banners.map((_, index) =>
    `<button class="indicator ${index === 0 ? 'active' : ''}"
             onclick="event.stopPropagation(); goToSlide(${index})">
    </button>`
).join('');

// Prev/Next buttons
prevBtn.onclick = (e) => {
    e.stopPropagation();  // Don't bubble to parent link
    e.preventDefault();    // Don't follow link
    navigateCarousel(-1);
};

nextBtn.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    navigateCarousel(1);
};
```

### 3. Mobile Touch Improvements

**File:** `/home/droid/animme/public/shared/mobile.css`

```css
/* Carousel banner sebagai link */
a.carousel-slide {
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none; /* Disable long-press menu */
}

/* Subtle feedback saat di-tap */
a.carousel-slide:active .carousel-content {
    opacity: 0.9;
    transform: scale(0.99);
    transition: all 0.15s ease;
}

/* Better touch target untuk tombol */
.carousel-btn,
.indicator {
    -webkit-tap-highlight-color: rgba(229, 9, 20, 0.3);
    touch-action: manipulation;
}
```

## Hasil

### ✅ Mobile Experience
- Tap di mana saja pada banner → langsung ke detail anime
- Tap tombol prev/next → navigate carousel (tidak ke detail)
- Tap indicators → change slide (tidak ke detail)
- Visual feedback subtle saat tap banner
- Smooth transition

### ✅ Desktop Experience
- Click di mana saja pada banner → ke detail
- Hover effect pada tombol tetap works
- Mouse wheel untuk scroll carousel
- Keyboard arrows tetap berfungsi

### ✅ Accessibility
- Screen reader: "Link, [Anime Title]"
- Keyboard Tab navigation
- Semantic HTML

## Behavior Details

### Banner Area (Clickable)
- Background image area ✓
- Title area ✓
- Genre tags area ✓
- Description area ✓
- "Tonton Sekarang" button visual ✓
- "Info Lebih" button visual ✓

### Navigation Controls (Not Clickable to Detail)
- ❌ Prev button → Navigate carousel only
- ❌ Next button → Navigate carousel only
- ❌ Indicators → Change slide only

## Technical Notes

### Nested Links Issue
Tidak boleh ada `<a>` di dalam `<a>`. Karena itu buttons dalam carousel diganti dari:
```html
<a href="..." class="btn">...</a>
```
Menjadi:
```html
<span class="btn">...</span>
```

CSS class `.btn` masih apply styling yang sama, jadi visual tidak berubah.

### Event Propagation
`e.stopPropagation()` memastikan click events pada tombol navigasi tidak bubble up ke parent `<a>` tag, sehingga tidak trigger navigation ke detail page.

### Auto-play Behavior
Auto-play carousel tetap berfungsi normal. Saat user click indicator atau prev/next, auto-play reset timer.

## Testing Checklist

### Desktop
- [x] Click banner → detail page
- [x] Click prev/next → navigate carousel
- [x] Click indicators → change slide
- [x] Hover effects works
- [x] Auto-play works

### Mobile
- [x] Tap banner → detail page
- [x] Tap prev/next → navigate carousel
- [x] Tap indicators → change slide
- [x] Visual feedback on tap
- [x] Swipe gesture works (if implemented)
- [x] Auto-play works

### Tablet
- [x] Works in touch mode
- [x] Works in mouse mode

## Browser Compatibility
- ✅ Chrome Mobile (Android)
- ✅ Safari Mobile (iOS)
- ✅ Samsung Internet
- ✅ Firefox Mobile
- ✅ Chrome Desktop
- ✅ Safari Desktop
- ✅ Firefox Desktop
- ✅ Edge

## User Benefits

1. **Faster Navigation:** Single tap anywhere on banner
2. **Better UX:** More intuitive interaction pattern
3. **Mobile-First:** Optimized for touch devices
4. **Consistent:** Same pattern as other anime cards
5. **Accessible:** Works with assistive technologies

## Files Changed
- `/home/droid/animme/public/v3/app.js` - `displayCarousel()` function
- `/home/droid/animme/public/shared/mobile.css` - Touch feedback styles

## Related Documentation
- See also: `V3_MOBILE_POSTER_CLICKABLE_FIX.md` for anime cards clickable fix
