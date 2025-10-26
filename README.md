# 🎬 AnimMe - Anime Streaming Platform

Aplikasi streaming anime dengan scraper otomatis dari Otakudesu, dilengkapi dengan sistem caching gambar dan privacy-focused design.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Fitur Utama

- 🎥 **Streaming Video** dengan multiple quality (360p, 480p, 720p)
- 🔄 **Auto Server Switching** - Ganti server jika yang satu tidak jalan
- 📱 **Fully Responsive** - Mobile, tablet, dan desktop
- 🖼️ **Image Caching System** - Menyembunyikan URL asli dan mempercepat loading
- 🔒 **Privacy Focused** - Tidak ada tracking, tidak ada ads
- 🎯 **Clean URLs** - `/detail/anime-slug` bukan `/detail.html?slug=...`
- 📥 **Batch Downloads** - Download semua episode sekaligus
- 🔍 **Search Function** - Cari anime favorit dengan mudah
- 📅 **Jadwal Rilis** - Lihat jadwal anime ongoing
- 🎭 **Genre Filter** - Filter anime berdasarkan genre

## 🚀 Quick Start

### Prasyarat
- Node.js >= 14.0.0
- NPM atau Yarn

### Instalasi

```bash
# Clone repository
git clone https://github.com/yourusername/animme.git
cd animme

# Install dependencies
npm install

# Jalankan server
npm start

# Buka browser
# http://localhost:5000
```

## 📁 Struktur Proyek

```
animme/
├── server/
│   ├── server.js           # Express server & routing
│   ├── scraper.js          # Otakudesu scraper
│   └── server-scraper.js   # Scraper alternative
├── public/
│   ├── index.html          # Homepage
│   ├── detail.html         # Detail anime
│   ├── player.html         # Video player
│   ├── app.js              # Homepage logic
│   ├── detail.js           # Detail page logic
│   ├── player.js           # Player logic
│   ├── styles.css          # Main styles
│   └── mobile.css          # Mobile responsive
├── cache/
│   └── images/             # Cached images
├── docs/
│   └── [documentation files]
├── package.json
└── README.md
```

## 🎮 Cara Menggunakan

### 1. Homepage
- Browse anime ongoing dan completed
- Gunakan search untuk cari anime
- Klik anime untuk lihat detail

### 2. Detail Anime
- Lihat informasi lengkap anime
- Pilih episode yang ingin ditonton
- Download batch untuk semua episode

### 3. Player
- Video otomatis play dengan kualitas default (480p)
- Ganti kualitas/server jika buffering
- Navigasi ke episode sebelum/sesudah
- Download episode individual

## 🔧 API Endpoints

### Homepage
```
GET /api/home
Response: { ongoing_anime: [], complete_anime: [] }
```

### Anime Detail
```
GET /api/anime/:slug
Response: { title, genres, episode_lists, batch, ... }
```

### Episode Detail
```
GET /api/episode/:slug
Response: { title, streaming_mirrors, download_links, ... }
```

### Search
```
GET /api/search/:keyword
Response: [ { title, slug, poster, ... } ]
```

### Batch Download
```
GET /api/batch/:slug
Response: { title, download_list, ... }
```

Lihat [docs/README.md](docs/README.md) untuk dokumentasi lengkap API.

## 🎨 Fitur Teknis

### Image Caching System
- Gambar dari Otakudesu di-cache lokal
- URL asli disembunyikan dengan hash MD5
- Auto-download saat gambar belum ada di cache
- Serve dengan max-age 1 tahun

### Quality Selection
- Menggunakan WordPress AJAX API dari Otakudesu
- Nonce-based authentication
- Support 360p, 480p, 720p
- Multiple server per quality

### Episode Parsing
- Otomatis deteksi episode number
- Support OVA, Movie, Special
- Extract dari title atau slug
- Smart display di frontend

## 🛠️ Konfigurasi

### Port
Default port: `5000`

Ubah di `server/server.js`:
```javascript
const PORT = process.env.PORT || 5000;
```

### Cache Directory
Default: `cache/images/`

Ubah di `server/server.js`:
```javascript
const CACHE_DIR = path.join(__dirname, '../cache/images');
```

## 📚 Dokumentasi

Dokumentasi lengkap ada di folder `docs/`:

- [API Documentation](docs/README.md)
- [Image Caching System](docs/IMAGE_CACHING_SYSTEM.md)
- [Privacy Implementation](docs/PRIVACY_IMPLEMENTATION.md)
- [Player Quality Selection](docs/PLAYER_QUALITY_SELECTION.md)
- [Episode Number Parsing](docs/EPISODE_NUMBER_PARSING.md)
- [Console Errors Explanation](docs/CONSOLE_ERRORS_EXPLANATION.md)
- [Mobile Optimization](docs/MOBILE_OPTIMIZATION.md)
- [Clean URLs Implementation](docs/CLEAN_URLS.md)

## 🐛 Troubleshooting

### Video tidak play
- Coba ganti server (klik tombol server lain)
- Refresh halaman
- Cek console untuk error

### Gambar tidak muncul
- Cek folder `cache/images/` ada dan writable
- Cek network connection ke otakudesu.best

### API Error
- Pastikan otakudesu.best accessible
- Cek scraper masih compatible (struktur HTML bisa berubah)

## 🔒 Privacy & Security

- ✅ Tidak ada tracking script (Google Analytics, dll)
- ✅ Tidak ada ads
- ✅ URL gambar disembunyikan
- ✅ Tidak menyimpan data user
- ✅ Tidak ada cookies yang tidak perlu

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repo
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License.

## ⚠️ Disclaimer

Proyek ini dibuat untuk tujuan edukasi. Semua konten anime adalah milik Otakudesu dan pemilik aslinya. Kami tidak meng-host video apapun, hanya menyediakan link ke sumber asli.

## 🙏 Credits

- **Data Source**: [Otakudesu](https://otakudesu.best)
- **Streaming**: Desustream
- **Framework**: Express.js
- **Scraping**: Axios + Cheerio

## 📧 Contact

Untuk pertanyaan atau saran, silakan buka issue di GitHub.

---

Made with ❤️ by AnimMe Team
