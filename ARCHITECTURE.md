# Arsitektur LanPro

Dokumen ini menjelaskan **struktur nyata** repositori ini, aturan yang berlaku,
dan utang teknis yang masih terbuka.

> **Catatan penting bagi pembaca.**
> Versi sebelumnya dokumen ini bersifat aspirasional: ia menetapkan aturan
> ("maksimal 800 baris", "zero hardcoded secrets, actively scanned") yang saat
> itu dilanggar oleh codebase-nya sendiri. Dokumen yang menggambarkan keadaan
> ideal alih-alih keadaan nyata justru menyesatkan developer baru.
>
> Karena itu dokumen ini memisahkan dengan tegas **aturan yang wajib dipatuhi
> untuk kode baru** dari **utang yang masih ada di kode lama**, lengkap dengan
> angkanya. Bila Anda memperbaiki salah satu utang itu, perbarui angkanya.

Terakhir diverifikasi: **14 Agustus 2026** — 219 file, 66.302 baris.

---

## 1. Struktur direktori

```text
lanpro-3.1/
├── server.ts                   Entry point backend. Bootstrap, middleware, Socket.IO.
├── src/                        FRONTEND
│   ├── AppContainer.tsx        Container global: state, socket, routing tampilan.
│   ├── components/             Komponen UI yang dipakai lintas fitur.
│   ├── features/               MODUL DOMAIN. Satu folder per fitur.
│   ├── hooks/                  Custom hook lintas fitur.
│   ├── lib/                    Infrastruktur: api, db, permissions, storage.
│   ├── store/                  State global Zustand.
│   └── types/                  Tipe global.
├── server/                     BACKEND
│   ├── routes/                 Definisi rute.
│   ├── controllers/            Logika penanganan request.
│   ├── middleware/             auth, rbac, errorHandler.
│   ├── services/               Query DB dan operasi berat.
│   └── migrations/             Migrasi schema.
├── scripts/
│   └── doctor.cjs              Pemeriksa kesehatan environment & keamanan.
└── .claude/launch.json         Konfigurasi peluncuran aplikasi.
```

### Frontend dan backend sudah terpisah secara logis

`src/` adalah frontend, `server/` adalah backend. Pemisahan itu **sudah ada**.
Rencana memindahkannya ke `client/` dan `server/` (monorepo formal) sengaja
**ditunda**: manfaatnya kosmetik, sementara biayanya menulis ulang import di
219 file. Ketika keputusan itu diambil codebase masih memuat 145 error
TypeScript, sehingga mustahil membedakan import yang baru rusak dari error
lama. `tsc` kini bersih, jadi kalau suatu saat langkah ini diambil, ia bisa
menjadi jaring pengaman yang bermakna.

---

## 2. Pola pemecahan fitur (WAJIB untuk fitur besar)

Fitur yang tumbuh besar dipecah menjadi lapisan terpisah. Folder
`src/features/flowchart/` adalah **contoh acuan**:

```text
src/features/flowchart/
├── index.tsx                     Barrel export.
├── FlowchartContainer.tsx        Komponen: state + JSX.
├── types.ts                      Tipe domain. Tanpa React.
├── constants.ts                  Data statis.
├── lib/
│   ├── routing.ts                Logika murni. Tanpa React, DOM, jaringan.
│   └── shapes.tsx                Presentasi murni: data masuk, markup keluar.
├── services/
│   └── flowchart.service.ts      SATU-SATUNYA tempat bicara ke backend.
└── components/                   Sub-komponen.
```

### Aturan lapisan

| Lapisan | Boleh | Dilarang |
|---|---|---|
| `types.ts` | tipe, interface | apa pun yang punya runtime |
| `lib/` | fungsi murni | state, `fetch`, akses DOM global |
| `services/` | `apiRequest`, pemetaan data | JSX, hook React |
| `components/` | JSX, hook UI | `apiRequest` langsung |
| Container | menyusun semuanya | logika yang bisa diturunkan ke lapisan lain |

**Komponen tidak boleh memanggil `apiRequest` langsung.** Semua panggilan
backend lewat `services/`. Ini menjaga detail penyandian tetap terkurung —
misalnya, flowchart disimpan di tabel `Documents` dengan node/edge
diserialisasi sebagai JSON ke kolom `description`; hanya `flowchart.service.ts`
yang perlu tahu itu.

### Cara memecah file besar dengan aman

Urutkan dari risiko terendah. Yang berada **di luar komponen** dipindahkan
lebih dulu, karena tidak menyentuh state maupun siklus hidup React:

1. Tipe → `types.ts`
2. Fungsi murni → `lib/`
3. Konstanta → `constants.ts`
4. Panggilan API → `services/`
5. **Baru** membelah komponennya sendiri (paling berisiko)

Setelah tiap langkah, bandingkan daftar error `tsc` **baris per baris** dengan
kondisi sebelumnya:

```bash
npx tsc --noEmit 2>&1 | grep "^src/features/<fitur>" | sort > after.txt
diff before.txt after.txt
```

Menghitung *jumlah total* error tidak cukup: satu error bisa hilang sementara
error baru muncul, dan totalnya tetap sama. Cara ini pernah menangkap bug
nyata — import service bernama `updateFlowchart` terbayang oleh binding dengan
nama sama dari `useFlowchartList()`, sehingga panggilan mengenai fungsi yang
salah.

---

## 3. Aturan wajib

### 3.1 Batas ukuran file

File baru **tidak boleh melebihi 500 baris**. Bila mendekati, pecah memakai
pola di bagian 2.

### 3.2 Tanpa rahasia ter-hardcode

Kredensial hanya boleh dari `process.env`. **Tidak boleh ada nilai fallback**
yang di-hardcode — konfigurasi yang hilang harus gagal secara terbuka, bukan
diam-diam memakai kredensial lain.

**`.gitleaks.toml` tidak boleh memuat nilai rahasia di allowlist.** Bila commit
lama mengandung rahasia yang sudah dirotasi, kecualikan **commit**-nya, bukan
nilainya. Aturan ini lahir dari insiden nyata: allowlist pernah berisi password
Neon dan dua Google API key secara harfiah, sehingga pemindai bungkam persis
pada kebocoran yang paling perlu dideteksi.

### 3.3 Verifikasi tidak boleh berhenti di "build hijau"

`npm run build` dan `npm test` **tidak membuktikan aplikasi berjalan.**

Pernah terjadi: 28/28 test lolos dan build sukses, sementara `AppContainer`
melempar `ReferenceError` saat render sehingga seluruh UI diganti error
boundary. Tidak ada test yang me-render `AppContainer`, jadi tidak ada yang
tahu. `GET /` tetap membalas 200 karena yang terkirim hanya HTML shell.

Verifikasi minimum untuk perubahan frontend:

```bash
npm run doctor          # environment, kredensial, konfigurasi keamanan
npm run build
npm test
npm run dev             # lalu BUKA di browser dan pastikan UI benar-benar tampil
```

### 3.4 Database

Adapter di `src/lib/db.ts` adalah **Neon PostgreSQL saja**. Tidak ada MySQL —
`package.json` hanya memuat driver `pg`.

Default export-nya `Proxy` yang sengaja meniru permukaan API mysql2
(`getConnection`, `query`, `execute`, `beginTransaction`), lengkap dengan
konverter SQL MySQL→PG. Dulu di-import dengan nama `mysqlPool`, yang berulang
kali menimbulkan dugaan keliru bahwa ada dua database. Sejak commit `12decab`
namanya `db`.

### 3.5 Keamanan lapisan aplikasi

- **CSP** aktif di production, dimatikan di dev agar HMR Vite berfungsi.
  `frame-src` mengizinkan `https:`, `data:`, dan `blob:` karena aplikasi
  menyematkan Figma, Google Docs, dan pratinjau berkas lewat iframe;
  `script-src` mengizinkan `cdn.lordicon.com` yang dimuat `index.html`.
  Menambah sumber eksternal baru berarti memperbarui direktif ini — dan
  **wajib diuji dengan menjalankan build produksi**, bukan sekadar memastikan
  header terkirim.
- **CORS** Socket.IO memakai daftar origin. Di production hanya
  `ALLOWED_ORIGINS`/`APP_URL`. Bila keduanya kosong, server **menolak menyala**
  dengan pesan yang jelas — sebelumnya ia menyala normal lalu menolak seluruh
  koneksi realtime secara senyap.
- **Rate limit** berlapis dan dipisah sesuai sifat ancamannya:
  - global 1000/5 menit
  - `loginLimiter` 10/15 menit, `skipSuccessfulRequests` **aktif** — pada login
    yang berbahaya adalah percobaan GAGAL
  - `registerLimiter` 5/jam, `skipSuccessfulRequests` **mati** — pada register
    justru keberhasilan yang berbahaya, karena tiap sukses menambah satu akun
  - Keduanya **tidak** membebaskan localhost; brute force dari mesin lokal
    tetap brute force.
- **XSS**: React meng-escape secara bawaan dan `react-markdown` tidak
  mengaktifkan `rehype-raw`, sehingga HTML mentah tidak pernah dirender.
  Jangan menambahkan `rehype-raw` tanpa sanitasi.

---

## 4. Perintah

```bash
npm run doctor    # periksa environment, kredensial, konfigurasi keamanan
npm run dev       # jalankan aplikasi di http://localhost:3000
npm run build     # vite build + bundle server
npm test          # jest
npm run lint      # tsc --noEmit + validasi permission
```

---

## 5. Utang teknis yang masih terbuka

Bagian ini sengaja jujur. Perbarui angkanya bila Anda memperbaikinya.

### 5.1 File yang melebihi batas 500 baris

**15 file di atas 1.000 baris, 16 file di rentang 500–1.000.** Terbesar:

| Baris | File |
|---:|---|
| 5.616 | `src/AppContainer.tsx` |
| 5.401 | `src/features/flowchart/FlowchartContainer.tsx` |
| 2.244 | `server/routes/meetings.routes.ts` |
| 2.104 | `src/features/users/index.tsx` |
| 1.910 | `server/routes/task.routes.ts` |

`FlowchartContainer` sudah turun dari 6.795 baris; sisanya adalah komponen itu
sendiri, yang butuh pembelahan JSX dan state.

### 5.1b `index.tsx` dipakai sebagai God Object, bukan barrel

```
2.104  users/index.tsx        1.539  issues/index.tsx
1.591  timeline/index.tsx     1.165  notebook-lm/index.tsx
1.545  wiki/index.tsx         1.159  dashboard/index.tsx
```

Barrel file semestinya hanya melakukan re-export. Enam fitur menaruh seluruh
implementasinya di sana, sehingga `import { X } from './features/users'`
menarik 2.104 baris.

### 5.1c Aturan lapisan services dilanggar 14 dari 21 fitur

Hanya `flowchart` yang memiliki pemisahan lengkap (`types` + `lib` +
`services` + `components`). Empat belas fitur lain memanggil `apiRequest`
atau `fetch` langsung dari komponen, melanggar aturan di bagian 2.

### 5.1d Lapisan `controllers/` praktis mati

**Nol dari 14 file di `server/routes/` yang meng-import dari `controllers/`.**
Seluruh logika ditulis inline di dalam definisi rute — itulah sebabnya
`meetings.routes.ts` mencapai 2.244 baris. Struktur direktorinya sudah benar,
tetapi isinya menumpuk di tempat yang salah.

### 5.2 ~~128 error TypeScript — CI merah~~ SELESAI 14 Agu 2026

`tsc --noEmit` bersih (0 error) dan `npm run lint` keluar dengan kode 0.
Pipeline CI tidak lagi berhenti di tahap pertama.

Dua penyebabnya:

1. Ekstraksi rute dari `server.ts` meninggalkan referensi ke simbol yang hanya
   hidup di scope `server.ts` — `Type` (93x), `io` (10x), `GoogleGenAI` (6x),
   `generateContentWithFallback` (6x), `createAuditLog` (3x).
2. `FlowNode` terduplikasi di **empat** tempat dengan dua bentuk berbeda: dua
   memakai `type: string` yang longgar, dua memakai union 68 bentuk. Kini
   seluruhnya bersumber dari `src/features/flowchart/types.ts`.

Sebelas endpoint sempat melempar `ReferenceError` begitu dipanggil — milestone
CRUD (Roadmap & Timeline), unduh dokumen, rekaman dan analisis rapat, serta
seluruh backend NotebookLM. Semuanya sudah diverifikasi berfungsi lewat
pemanggilan langsung.

Untuk `io`, lihat `server/config/socket.ts`: sebagian pemancaran event terjadi
di `runAIPipeline()`, fungsi level-modul yang berjalan setelah response
terkirim sehingga tidak punya akses ke `req.io`. Registry kecil itu memutus
lingkaran dependensi antara `server.ts` dan modul rute.

**Pelajaran yang tetap berlaku:** build sukses BUKAN bukti kode benar. Vite dan
esbuild hanya melakukan transpile tanpa type-check, sehingga 128 error dan
sebelas endpoint rusak dapat bertahan lama tanpa terdeteksi. Jaga
`npm run lint` tetap hijau agar sinyalnya tidak kembali tenggelam.

### 5.2b NotebookLM rusak di dua sisi

Selain backend di atas, frontend-nya membaca kunci token yang salah:
`safeLocalStorage.getItem('token')` padahal kunci sebenarnya
`'lanpro_jwt_token'` (lihat `src/lib/api.ts`). Akibatnya setiap request
mengirim header `Authorization: Bearer ` yang kosong dan dibalas 401.
Terjadi di 4 tempat: `src/features/notebook-lm/index.tsx` baris 155, 261,
308, dan 352.

Memperbaiki salah satu sisi saja tidak akan memulihkan fitur ini.

Catatan tambahan: fitur ini memanggil `GET /api/projects/:id/wiki`, endpoint
yang tidak pernah ada di backend (404 bahkan dengan token yang benar).

### 5.3 Tidak ada test yang me-render komponen

28 test yang ada menguji util, hook terisolasi, dan middleware. **Tidak satu
pun me-render `AppContainer`.** Selama ini belum berubah, sehingga kerusakan
render masih bisa lolos tanpa terdeteksi.

### 5.4 Store yang menganggur

`authStore` dan `uiStore` dibuat pada Phase 18 tetapi belum dipakai.
`AppContainer` masih mengambil state auth dari `hooks/useAuth.ts`.

Ini **disengaja**. Mengambil setter dari store sementara state dibaca dari hook
akan menghasilkan penulisan yang tidak dibaca siapa pun — crash berganti
menjadi bug senyap yang jauh lebih sulit dilacak. Migrasi penuh sebaiknya
menunggu adanya test render.

### 5.5 Rahasia yang masih perlu ditindaklanjuti

- **Dua Google API key** (`AIzaSyCLtjweG46C63xPMb4aL41ovCzAoGpvGRg`,
  `AIzaSyCBrrjPs52DmZ4sNRmf1URAsnFwfT_oibg`) pernah ada di histori git dan
  **belum dicabut** di Google Cloud Console. Keduanya tidak ada di source aktif
  dan tidak sedang dipakai.
- **Password Neon lama** sudah dirotasi dan terbukti mati (`28P01`), tetapi
  nilainya masih tercatat di histori git. Pembersihan histori bersifat higiene,
  bukan lagi mitigasi risiko.
