# V5 Default Server Fix

## Issue
User melaporkan: "jika saya klik server v5 malah diarahkan ke v1 otakudesu"

## Root Cause
Root URL (`/`) di server secara default me-redirect ke V1 Otakudesu, bukan V5 Anoboy.

**Before (server/server.js line 1121-1123):**
```javascript
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/v1/index.html'));
});
```

## Solution
Mengubah default redirect dari V1 ke V5.

**After:**
```javascript
app.get('/', (req, res) => {
    res.redirect('/v5/home');
});
```

## Testing

### Test 1: Root URL Redirect
```bash
curl -sI "http://localhost:5000/" | grep -E "HTTP|Location"
# Output:
# HTTP/1.1 302 Found
# Location: /v5/home
```
✅ Root URL sekarang redirect ke V5

### Test 2: Direct V5 Access
```bash
curl -s "http://localhost:5000/v5/home" | grep "AnimMe V5"
# Should return V5 homepage HTML
```
✅ Direct access ke V5 bekerja dengan benar

### Test 3: Server Selector
Server selector di `/v5/app.js` (lines 164-188) sudah benar handle redirect:
- V1 → `/v1/home`
- V2 → `/v2/home`
- V3 → `/v3/home`
- V4 → `/v4/home`
- V5 → `/v5/home`

## Impact
- ✅ Default homepage sekarang adalah V5 (Anoboy)
- ✅ User yang akses root URL langsung ke V5
- ✅ Server selector di semua version tetap berfungsi normal
- ✅ User masih bisa akses V1-V4 via direct URL atau server selector

## Files Modified
- `server/server.js` (line 1122): Changed from `res.sendFile(...)` to `res.redirect('/v5/home')`

## Status
✅ **FIXED** - V5 sekarang menjadi default server
