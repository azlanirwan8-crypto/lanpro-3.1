# LanPro

Project management platform: perencanaan sprint, pelacakan issue, notulen rapat
berbantuan AI, editor flowchart, dan QA test management.

**React 19 + Vite + Tailwind CSS v4** di sisi klien, **Express + Neon PostgreSQL**
di sisi server, dengan Socket.IO untuk pembaruan real-time.

## Menjalankan

```bash
npm install
npm run doctor    # periksa environment, kredensial, konfigurasi keamanan
npm run dev       # http://localhost:3000
```

## Perintah

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Jalankan aplikasi (Vite + Express dalam satu proses) |
| `npm run doctor` | Periksa `.env`, koneksi database, dan konfigurasi keamanan |
| `npm run build` | Build produksi (vite build + bundle server) |
| `npm test` | Jest — proyek `node` dan `jsdom` |
| `npm run lint` | `tsc --noEmit` + validasi permission |

## Struktur

```
api/          Entry serverless Vercel (wajib di root — konvensi platform)
src/          Frontend: AppContainer, features/, components/, services/, lib/
server/       Backend: routes/, services/, middleware/, config/, migrations/
scripts/      Utilitas: doctor, seed, migrasi, validasi
database/     Skema dan migrasi
infrastructure/ docker-compose dan nginx
docs/         Dokumentasi; docs/legacy/ untuk arsip rujukan
shims/        Shim dependensi
```

`Dockerfile`, `vite.config.ts`, `tsconfig*.json`, `jest.config.cjs`, dan
`vercel.json` berada di root karena tool masing-masing mencarinya persis di sana.

## Dokumentasi

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — struktur nyata, aturan lapisan, sistem
  desain, dan daftar utang teknis yang masih terbuka. **Baca ini lebih dulu.**
- [docs/TESTING_PATTERNS.md](docs/TESTING_PATTERNS.md) — pola pengujian
- [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md) — daftar periksa keamanan
- [docs/DISASTER_RECOVERY.md](docs/DISASTER_RECOVERY.md) — pemulihan bencana

## Aturan yang wajib dipatuhi

1. Komponen tidak memanggil `apiRequest`/`fetch` langsung — selalu lewat `services/`.
2. Warna hanya lewat token semantik, bukan hex di JSX. Lihat ARCHITECTURE.md §6.
3. `npm run build` hijau BUKAN bukti aplikasi jalan. Buka browser sebelum menyatakan selesai.
