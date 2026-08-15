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

Terakhir diverifikasi: **15 Agustus 2026** — 303 file, 71.669 baris.

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
│   ├── routes/                 Definisi rute. Satu berkas per domain.
│   ├── middleware/             auth, rbac, errorHandler.
│   ├── config/                 socket, metrics, uploads.
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
├── index.ts                      Barrel. HANYA re-export.
├── FlowchartContainer.tsx        Komponen: state + penyusunan.
├── types.ts                      Tipe domain. Tanpa React.
├── constants.ts                  Data statis.
├── lib/
│   ├── routing.ts                Logika murni. Tanpa React, DOM, jaringan.
│   ├── importers.ts              Parser Draw.io & Miro. Teks masuk, data keluar.
│   ├── nodeTheme.ts              Pemetaan node → kelas Tailwind.
│   └── shapes.tsx                Presentasi murni: data masuk, markup keluar.
├── services/
│   └── flowchart.service.ts      SATU-SATUNYA tempat bicara ke backend.
└── components/                   FlowchartNode, FlowchartEdges, ShapePalette,
                                  ImportDiagramModal, FlowchartDashboard,
                                  CanvasToolbar, NodePropertiesOverlay, ...
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

**15 file di atas 1.000 baris, 18 file di rentang 500–1.000.** Terbesar:

| Baris | File |
|---:|---|
| 4.903 | `src/AppContainer.tsx` |
| 3.420 | `src/features/flowchart/FlowchartContainer.tsx` |
| 1.779 | `server/routes/task.routes.ts` |
| 1.693 | `src/features/meeting-notes/AiMeetingCompanion.tsx` |
| 1.591 | `src/features/timeline/TimelinePanel.tsx` |
| 1.436 | `server/routes/qa.routes.ts` |

`FlowchartContainer` turun dari 6.795 ke 3.420 baris lewat tujuh komponen di
`components/` dan empat modul di `lib/`. Sisanya adalah state dan handler yang
saling terkait; menurunkannya lebih jauh berarti memindahkan handler ke hook,
yang risikonya berbeda dari memindahkan JSX.

`AppContainer` turun dari 5.168 ke 4.903 baris. Angkanya masih besar karena
isinya didominasi handler yang menyentuh state bersama, bukan blok tampilan
yang bisa dipotong.

### 5.1b ~~`index.tsx` dipakai sebagai God Object~~ SELESAI 15 Agu 2026

Enam fitur dulu menaruh seluruh implementasinya di `index.tsx`, sehingga
`import { X } from './features/users'` menarik ribuan baris lewat berkas yang
namanya tidak menyebut apa pun. Kini tiap fitur punya berkas bernama
(`AdminUserPanel.tsx`, `DashboardView.tsx`, `IssueListView.tsx`,
`TimelinePanel.tsx`, `WikiView.tsx`, `NotebookLM.tsx`) dengan `index.ts` yang
isinya semata re-export.

Ini sekaligus menutup cacat lama: `features/dashboard` dan `features/issues`
sempat memuat `index.ts` DAN `index.tsx` sekaligus, dengan `index.ts`
mengimpor `'./index.tsx'` memakai ekstensi eksplisit. Vite meresolusinya,
TypeScript dengan program penuh tidak.

### 5.1c ~~Aturan lapisan services dilanggar 14 dari 21 fitur~~ SELESAI 15 Agu 2026

**16 dari 21 fitur memiliki folder `services/`.** Lima sisanya — `activity`,
`auth`, `planning`, `sidebar`, `timeline` — tidak punya karena memang tidak
pernah bicara ke backend; datanya datang lewat props dari `AppContainer`.
Menambahkan folder kosong di sana hanya kerapian semu.

`AppContainer` sendiri sempat memanggil `apiRequest` 44 kali secara langsung.
Empat puluh tiga di antaranya kini lewat `src/services/`; satu yang tersisa
adalah panggilan generik dengan URL yang dirakit saat runtime.

### 5.1d ~~Lapisan `controllers/` praktis mati~~ SELESAI 15 Agu 2026

Direktori `server/controllers/` **dihapus**. Isinya satu berkas sepanjang 5
baris yang seluruhnya import tanpa satu pun fungsi, dan nol berkas rute yang
mengimpornya — bukan lapisan mati yang perlu disambungkan, melainkan kerangka
kosong yang tidak pernah terisi.

**Pola resmi backend kini `routes/` + `services/`.** Rute mengurus request dan
response; logika berat turun ke `server/services/`. Menambah lapisan ketiga
hanya menambah tempat untuk salah menaruh logika.

`meetings.routes.ts` yang dulu 2.264 baris dan menampung enam domain sekaligus
kini 1.052 baris. Lima domain lain pindah ke berkas sendiri
(`notebooklm`, `project-modules`, `documents`, `milestones`,
`discussion-points`), dan `task.routes.ts` yang dulu di-mount dari dalamnya
kini di-mount langsung dari `server.ts`.

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

### 5.3 ~~Tidak ada test yang me-render komponen~~ SELESAI 15 Agu 2026

Jest kini terbagi dua proyek: `*.test.ts` berjalan di lingkungan node seperti
sebelumnya, `*.test.tsx` di jsdom. **65 test, 9 suite.**

Dua di antaranya me-render komponen sungguhan: `AppContainer` pada jalur belum
login, dan `FlowchartView` pada kedua tampilannya (daftar dan kanvas editor).
Keduanya memeriksa `console.error` untuk pesan "The above error occurred",
karena React melaporkan kegagalan render lewat sana alih-alih melempar — tanpa
pemeriksaan itu komponen yang crash tetap lolos.

Yang masih terbuka: tidak ada test yang me-render `AppContainer` pada jalur
SUDAH login, sehingga kerusakan di jalur itu masih bisa lolos.

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
