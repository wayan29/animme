# 📁 AnimMe - Project Structure

## 📋 Overview
Project AnimMe adalah aplikasi web untuk streaming anime dengan multi-server support (V1: Otakudesu, V2: Samehadaku, V3: Kuramanime). Berikut adalah struktur folder yang terorganisir untuk memudahkan development dan maintenance.

## 🗂️ Folder Structure

```
animme/
├── 📂 public/              # Frontend files (HTML, CSS, JS)
│   ├── index.html          # V1 Homepage
│   ├── index-v3.html       # V3 Homepage (Kuramanime)
│   ├── styles.css          # Main stylesheet
│   ├── mobile.css          # Mobile responsive styles
│   ├── app.js              # V1 Main JavaScript
│   ├── app-v3.js           # V3 Main JavaScript
│   ├── detail-*.html       # Detail pages (V1, V2, V3)
│   ├── episode-*.html      # Episode pages
│   ├── player-*.html       # Video player pages
│   ├── ongoing-v3.html     # Ongoing anime list (V3)
│   ├── finished-v3.html    # Finished anime list (V3)
│   ├── movie-v3.html       # Movie list (V3)
│   ├── schedule-v3.html    # Release schedule (V3)
│   ├── search-v3.html      # Search page (V3)
│   ├── genres-v3.html      # Genre list (V3)
│   ├── genre-v3.html       # Genre detail (V3)
│   ├── seasons-v3.html     # Season list (V3) 🆕
│   ├── season-v3.html      # Season detail (V3) 🆕
│   └── ...                 # Other frontend files
│
├── 📂 server/              # Backend Node.js files
│   ├── server.js           # Main Express server
│   ├── scraper.js          # V1 Otakudesu scraper
│   ├── samehadaku-scraper.js  # V2 Samehadaku scraper
│   └── kuramanime-scraper.js  # V3 Kuramanime scraper
│
├── 📂 docs/                # Documentation files (62 files)
│   ├── README.md           # Main project documentation
│   ├── API-README.md       # API documentation
│   ├── CHANGELOG-*.md      # Version changelogs
│   ├── *-FEATURE-*.md      # Feature implementation docs
│   ├── *-FIX-*.md          # Bug fix documentation
│   └── ...                 # Other documentation
│
├── 📂 tests/               # Test files (30 files)
│   ├── test_*.js           # JavaScript test scripts
│   ├── test_*.sh           # Bash test scripts
│   ├── test-*.html         # HTML test pages
│   └── ...                 # Other test files
│
├── 📂 scripts/             # Utility scripts (6 files)
│   ├── debug_*.js          # Debug scripts
│   ├── analyze_*.js        # Analysis scripts
│   └── ...                 # Other utility scripts
│
├── 📂 logs/                # Log files (5 files)
│   ├── debug.log           # Debug logs
│   ├── server_*.log        # Server logs
│   ├── res.log             # Response logs
│   └── ...                 # Other log files
│
├── 📂 backups/             # Backup files
│   ├── server.js.bak       # Server backup
│   └── ...                 # Other backups
│
├── 📂 cache/               # Cache directory
│   └── images/             # Cached images
│
├── 📂 node_modules/        # NPM dependencies
│
├── 📄 package.json         # NPM package configuration
├── 📄 package-lock.json    # NPM lock file
├── 📄 .gitignore           # Git ignore rules
└── 📄 PROJECT-STRUCTURE.md # This file

```

## 📦 Main Directories

### `/public/` - Frontend
**Purpose:** Contains all client-side files (HTML, CSS, JavaScript)

**Key Features:**
- Multi-version support (V1, V2, V3)
- Responsive design (mobile.css)
- Modular JavaScript files
- Clean URL routing

**Main Pages:**
- **Homepage:** `index.html`, `index-v3.html`
- **Detail:** `detail-v2.html`, `detail-v3.html`
- **Episode:** `episode-v3.html`
- **Player:** `player-v2.html`
- **Lists:** `ongoing-v3.html`, `finished-v3.html`, `movie-v3.html`
- **Discovery:** `search-v3.html`, `genres-v3.html`, `seasons-v3.html`
- **Schedule:** `schedule-v3.html`

### `/server/` - Backend
**Purpose:** Node.js/Express backend with web scraping functionality

**Components:**
- **`server.js`** - Main Express server with routing
- **`scraper.js`** - Otakudesu scraper (V1)
- **`samehadaku-scraper.js`** - Samehadaku scraper (V2)
- **`kuramanime-scraper.js`** - Kuramanime scraper (V3)

**API Endpoints:**
- `/api/...` - V1 endpoints
- `/api/v2/...` - V2 endpoints
- `/api/v3/kuramanime/...` - V3 endpoints

### `/docs/` - Documentation
**Purpose:** All project documentation (62 files)

**Categories:**
- **API Docs:** API-README.md, API-TEST-RESULTS.md
- **Changelogs:** CHANGELOG-*.md
- **Features:** *-FEATURE-*.md
- **Fixes:** *-FIX-*.md
- **Guides:** CARA_MENJALANKAN.md, PAGINATION-GUIDE.md

### `/tests/` - Testing
**Purpose:** Test scripts and validation files (30 files)

**Types:**
- **JavaScript Tests:** `test_*.js`
- **Shell Scripts:** `test_*.sh`
- **HTML Tests:** `test-*.html`

### `/scripts/` - Utilities
**Purpose:** Debug and analysis scripts (6 files)

**Examples:**
- `debug_download_links.js` - Debug download functionality
- `debug_info.js` - Debug info extraction
- `analyze_metadata.js` - Analyze anime metadata

### `/logs/` - Logs
**Purpose:** Application logs and debugging output (5 files)

**Examples:**
- `debug.log` - General debug logs
- `server_output.log` - Server output
- `res.log` - Response logs

### `/backups/` - Backups
**Purpose:** Backup files for recovery

### `/cache/` - Cache
**Purpose:** Temporary cached data (images, etc.)

## 🎯 Key Features by Version

### V1 - Otakudesu
- Basic anime listing
- Episode streaming
- Download links

### V2 - Samehadaku
- Enhanced scraping
- Better detail pages
- Improved player

### V3 - Kuramanime ⭐ (Latest)
- **Home:** Hero carousel, trending anime
- **Ongoing:** Paginated ongoing anime list
- **Finished:** Completed anime list
- **Movies:** Movie collection
- **Schedule:** Weekly release schedule
- **Search:** Advanced search functionality
- **Genres:** Genre browsing and filtering
- **Seasons:** Season browsing with year filter 🆕
- **Detail:** Rich anime information
- **Episode:** Multi-server video player
- **Navigation:** Clean URLs and breadcrumbs

## 🚀 Quick Start

### Installation
```bash
npm install
```

### Run Server
```bash
node server/server.js
# Server runs on http://localhost:5000
```

### Access Application
- **V1:** http://localhost:5000/
- **V3:** http://localhost:5000/v3

## 📊 Statistics

- **Total Files:** ~200+
- **Documentation:** 62 files
- **Test Files:** 30 files
- **Frontend Pages:** 40+ HTML files
- **Backend Scrapers:** 3 scrapers
- **API Endpoints:** 50+ endpoints

## 🔧 Technology Stack

**Frontend:**
- HTML5, CSS3, JavaScript (Vanilla)
- Responsive design (mobile-first)
- Glass morphism UI design

**Backend:**
- Node.js + Express
- Cheerio (web scraping)
- Axios (HTTP requests)
- Puppeteer (dynamic scraping)

**Development:**
- Git version control
- NPM package management
- Modular architecture

## 📝 Development Guidelines

### Adding New Features
1. Create feature implementation in appropriate folder
2. Document in `/docs/` with *-FEATURE-*.md
3. Add tests in `/tests/`
4. Update this PROJECT-STRUCTURE.md

### File Naming Conventions
- **Frontend:** `component-version.html` (e.g., `detail-v3.html`)
- **Backend:** `source-scraper.js` (e.g., `kuramanime-scraper.js`)
- **Docs:** `FEATURE-NAME.md` (UPPERCASE)
- **Tests:** `test_feature.js` (lowercase with underscore)
- **Scripts:** `debug_feature.js` (lowercase with underscore)

### Version Control
- Main branch: `main`
- Commit with co-author attribution
- Use descriptive commit messages

## 🎨 UI/UX Design

**Color Scheme:**
- Primary: `#ff6b9d` (Pink)
- Secondary: `#60b0ff` (Blue)
- Background: Dark gradients
- Cards: Glass morphism effects

**Typography:**
- Primary: 'Segoe UI', Tahoma, Geneva
- Fallback: Verdana, sans-serif

**Responsive Breakpoints:**
- Desktop: 1400px max-width
- Tablet: 768px
- Mobile: 480px

## 🔐 Security

- CORS enabled
- Rate limiting on API
- Input sanitization
- Secure proxy for images

## 📈 Future Improvements

- [ ] User authentication
- [ ] Favorites/Watchlist
- [ ] Comments system
- [ ] Rating system
- [ ] PWA support
- [ ] Dark/Light theme toggle
- [ ] Advanced search filters
- [ ] Download manager

## 👥 Contributors

- Factory AI Agent (Droid)
- Development Team

---

**Last Updated:** October 29, 2025  
**Version:** 3.0  
**Status:** ✅ Production Ready
