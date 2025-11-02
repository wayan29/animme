# V5 Anoboy Search Title Duplication Fix

## Issue Date
November 2, 2025

## Problem
Search results were showing duplicate titles, e.g., "Spy x Family Season 3 Spy x Family Season 3"

## Root Cause

The HTML structure of search results on Anoboy has title text duplicated:

```html
<div class="tt">
    Spy x Family Season 3  <!-- Direct text node -->
    <h2 itemprop="headline">Spy x Family Season 3</h2>  <!-- Child h2 element -->
</div>
```

When using `.text()` on the `.tt` element, jQuery extracts ALL text content including:
1. Direct text node: "Spy x Family Season 3"
2. Child h2 text: "Spy x Family Season 3"

Result: Duplicate title

## Testing Process

### 1. Initial API Test
```bash
curl "http://localhost:5000/api/v5/anoboy/search?q=spy+x"
# Result: {"title":"Spy x Family Season 3 Spy x Family Season 3"}
```

### 2. HTML Structure Analysis
Created test script to examine HTML structure:
- Found `.tt` element contains both text node and h2 child
- Confirmed h2 contains clean, single title

### 3. Source Investigation
File: `server/anoboy/search.js`
```javascript
// BEFORE (line 19-23)
const $title = $el.find('.tt, .title').first();
const title = cleanText($title.text() || $link.attr('title') || '');
// This gets all text including duplicates
```

## Solution

Changed title extraction to use `h2` selector first (most accurate), with fallback to link title attribute:

```javascript
// AFTER (line 22-26)
// Try to get title from h2 first (most accurate), then from link title attribute
let title = cleanText($el.find('h2').first().text());
if (!title) {
    title = cleanText($link.attr('title') || '');
}
```

## File Modified
- `server/anoboy/search.js` (lines 15-43)

## Verification

### API Response After Fix
```json
{
  "status": "success",
  "data": {
    "keyword": "spy x",
    "results": [
      {
        "title": "Spy x Family Season 3",
        "slug": "anime/spy-x-family-season-3",
        "url": "https://anoboy.be/anime/spy-x-family-season-3/",
        "poster": "/img/1a7e9e421ce9c6e7a0fd59fd26205e60",
        "type": "",
        "score": ""
      }
    ],
    "total": 1
  }
}
```

### Search Test Results
✅ Title now shows single occurrence: "Spy x Family Season 3"
✅ No whitespace issues
✅ Search functionality works correctly
✅ Frontend display clean

## Technical Details

### Why h2 Selector Works
1. **Semantic correctness**: h2 is the actual heading element containing the title
2. **Single source of truth**: h2 contains only the title text without duplication
3. **WordPress theme standard**: Anoboy uses WordPress theme where h2 is the primary title element

### Fallback Strategy
If h2 is not found, fallback to link's `title` attribute:
```javascript
if (!title) {
    title = cleanText($link.attr('title') || '');
}
```

## Related Files
- `server/anoboy/search.js` - Fixed scraper
- `test-anoboy-search.js` - Initial diagnostic test
- `test-anoboy-search-detail.js` - Detailed HTML structure analysis

## Impact
- ✅ Fixes duplicate titles in search results
- ✅ Improves user experience
- ✅ Makes search display cleaner
- ✅ No breaking changes to API structure
- ✅ Compatible with all existing frontend code

## Prevention
Consider applying similar fix to other scrapers that might have the same issue:
1. Check `home.js` for latest releases title extraction
2. Check `azlist.js` for A-Z list title extraction
3. Check `detail.js` for anime detail title extraction

All should preferably use h2 or specific title elements instead of parent containers.

## Testing Checklist
- [x] API returns clean titles
- [x] No duplicate text
- [x] Search functionality works
- [x] Frontend displays correctly
- [x] Server restart successful
- [x] No errors in logs

## Conclusion
Title duplication in search results has been successfully fixed by changing the selector from `.tt` parent element to direct `h2` child element. The fix is clean, semantic, and follows WordPress theme standards.
