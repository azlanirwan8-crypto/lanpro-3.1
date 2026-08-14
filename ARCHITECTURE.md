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

Terakhir diverifikasi: **14 Agustus 2026** — 219 file, 66.279 baris.

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
219 file di atas codebase yang masih punya 145 error TypeScript — mustahil
membedakan mana import yang baru rusak dan mana error lama.

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
- **CORS** Socket.IO memakai daftar origin. Di production hanya
  `ALLOWED_ORIGINS`/`APP_URL`; bila kosong, lintas-origin ditolak seluruhnya.
- **Rate limit** berlapis: global 1000/5 menit, dan `authLimiter` khusus
  `/api/auth/login` dan `/register` sebesar 10 percobaan/15 menit.
  `authLimiter` **tidak** membebaskan localhost — brute force dari mesin lokal
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

### 5.2 145 error TypeScript — CI merah

```
119  server/routes/meetings.routes.ts
 20  src/features/flowchart/FlowchartContainer.tsx
  3  server/routes/project.routes.ts
  2  src/test/setup.tsx
  1  server/routes/user.routes.ts
```

Penyebab utama: ekstraksi rute dari `server.ts` meninggalkan referensi ke
simbol yang hanya hidup di scope `server.ts` (`io`, `GoogleGenAI`, `Type`,
`generateContentWithFallback`).

**Dampaknya nyata:** `.github/workflows/deploy.yml` menjalankan `npm run lint`,
sehingga pipeline berhenti di tahap pertama — build, deploy, dan hook Vercel
tidak pernah berjalan.

Build tetap sukses karena Vite dan esbuild hanya melakukan transpile, tanpa
type-check.

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
