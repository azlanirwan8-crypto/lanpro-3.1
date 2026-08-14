#!/usr/bin/env node
/**
 * LanPro Setup Doctor
 *
 * Memeriksa apakah environment siap menjalankan aplikasi, lalu memberi tahu
 * persis apa yang harus diperbaiki bila ada yang kurang.
 *
 * Jalankan: npm run doctor
 *
 * Tidak pernah mencetak nilai kredensial — hanya status dan sidik jari pendek.
 */

require('dotenv/config');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Password Neon yang pernah bocor di histori git publik. Doctor menolak
// environment yang masih memakainya.
const LEAKED_DB_PASSWORDS = ['npg_CVZvaYbF8W2s'];

let failed = 0;
let warned = 0;

const c = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', dim: '\x1b[2m', bold: '\x1b[1m',
};

function ok(msg, detail) {
  console.log(`  ${c.green}OK${c.reset}    ${msg}${detail ? c.dim + '  ' + detail + c.reset : ''}`);
}
function fail(msg, fix) {
  failed++;
  console.log(`  ${c.red}GAGAL${c.reset} ${msg}`);
  if (fix) console.log(`        ${c.dim}-> ${fix}${c.reset}`);
}
function warn(msg, fix) {
  warned++;
  console.log(`  ${c.yellow}WARN${c.reset}  ${msg}`);
  if (fix) console.log(`        ${c.dim}-> ${fix}${c.reset}`);
}
function section(title) {
  console.log(`\n${c.bold}${title}${c.reset}`);
}
function fingerprint(s) {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 8);
}

// ── 1. File environment ───────────────────────────────────────────
section('1. File environment');

if (!fs.existsSync(path.join(ROOT, '.env'))) {
  fail('.env tidak ditemukan', 'Salin .env.example jadi .env lalu isi nilainya');
} else {
  ok('.env ditemukan');
}

// .env tidak boleh ter-track git
try {
  const { execSync } = require('child_process');
  const tracked = execSync('git ls-files .env', { cwd: ROOT, encoding: 'utf8' }).trim();
  if (tracked) {
    fail('.env TER-TRACK oleh git — rahasia bisa ikut ter-push',
         'Jalankan: git rm --cached .env');
  } else {
    ok('.env tidak ter-track git');
  }
} catch {
  warn('Tidak bisa memeriksa status git untuk .env');
}

// ── 2. Variabel wajib ─────────────────────────────────────────────
section('2. Variabel yang wajib ada');

const REQUIRED = [
  ['DATABASE_URL', 'Connection string Neon Postgres'],
  ['JWT_SECRET', 'Kunci penandatangan token login'],
];

for (const [key, desc] of REQUIRED) {
  if (!process.env[key]) {
    fail(`${key} kosong  ${c.dim}(${desc})${c.reset}`, `Isi ${key} di file .env`);
  } else {
    ok(`${key} terisi`, `sidik jari ${fingerprint(process.env[key])}`);
  }
}

if (!process.env.POSTGRES_URL) {
  warn('POSTGRES_URL kosong', 'Sebagian kode membacanya sebagai cadangan — isi sama dengan DATABASE_URL');
} else if (process.env.POSTGRES_URL !== process.env.DATABASE_URL) {
  warn('POSTGRES_URL berbeda dari DATABASE_URL',
       'Biasanya keduanya harus sama. Pastikan ini memang disengaja');
} else {
  ok('POSTGRES_URL sama dengan DATABASE_URL');
}

// ── 3. Kesehatan connection string ────────────────────────────────
section('3. Connection string database');

let dbUrl = null;
try {
  dbUrl = new URL(process.env.DATABASE_URL || '');
} catch {
  if (process.env.DATABASE_URL) {
    fail('DATABASE_URL bukan URL yang valid', 'Pastikan diawali postgresql:// dan diapit tanda kutip di .env');
  }
}

if (dbUrl) {
  if (LEAKED_DB_PASSWORDS.includes(dbUrl.password)) {
    fail('DATABASE_URL memakai password yang SUDAH BOCOR di GitHub',
         'Rotasi password di console.neon.tech lalu perbarui .env');
  } else {
    ok('Password bukan yang pernah bocor');
  }

  if (!dbUrl.hostname.includes('-pooler')) {
    warn('Host tidak memakai connection pooling Neon',
         `DB_CONNECTION_LIMIT=${process.env.DB_CONNECTION_LIMIT || '100'} berisiko menabrak limit. Pakai host "-pooler"`);
  } else {
    ok('Memakai connection pooling Neon');
  }

  if (!dbUrl.searchParams.get('sslmode')) {
    warn('sslmode tidak diset di connection string', 'Tambahkan ?sslmode=require');
  } else {
    ok(`sslmode=${dbUrl.searchParams.get('sslmode')}`);
  }
}

// ── 4. Rahasia yang ter-hardcode di source ────────────────────────
section('4. Pemindaian rahasia di source code');

const SCAN_PATTERNS = [
  [/npg_[A-Za-z0-9]{8,}/g, 'password Neon'],
  [/api\.vercel\.com\/v1\/integrations\/deploy\/prj_[A-Za-z0-9]+/g, 'Vercel deploy hook'],
  [/aivencloud\.com/g, 'host Aiven warisan MySQL'],
];

const SCAN_DIRS = ['src', 'server', 'api', '.github', 'config', 'infrastructure'];
const SKIP_DIR = new Set(['node_modules', 'dist', 'coverage', '.git', 'uploads']);
const hits = [];

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (SKIP_DIR.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { walk(full); continue; }
    if (!/\.(ts|tsx|js|cjs|mjs|yml|yaml|json)$/.test(e.name)) continue;
    let content;
    try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
    for (const [re, label] of SCAN_PATTERNS) {
      if (new RegExp(re.source).test(content)) {
        hits.push({ file: path.relative(ROOT, full), label });
      }
    }
  }
}

for (const d of SCAN_DIRS) walk(path.join(ROOT, d));

// server.ts berada di root, bukan di dalam SCAN_DIRS — periksa terpisah.
try {
  const serverTs = fs.readFileSync(path.join(ROOT, 'server.ts'), 'utf8');
  for (const [re, label] of SCAN_PATTERNS) {
    if (new RegExp(re.source).test(serverTs)) hits.push({ file: 'server.ts', label });
  }
} catch {}

if (hits.length === 0) {
  ok('Tidak ada rahasia ter-hardcode di source aktif');
} else {
  for (const h of hits) {
    fail(`${h.label} ter-hardcode di ${h.file}`, 'Pindahkan ke environment variable / GitHub Secret');
  }
}

// ── 5. Konfigurasi keamanan ───────────────────────────────────────
// Memeriksa invarian yang pernah gagal di repo ini, agar tidak terulang diam-diam.
section('5. Konfigurasi keamanan');

// 5a. Allowlist gitleaks tidak boleh memuat nilai rahasia.
//     Versi lama file ini mendaftar-putihkan password Neon dan dua Google API
//     key secara harfiah, sehingga pemindai bungkam pada kebocoran sungguhan.
try {
  const gl = fs.readFileSync(path.join(ROOT, '.gitleaks.toml'), 'utf8');
  const nilaiRahasia = [
    [/AIza[0-9A-Za-z_-]{30,}/, 'Google API key'],
    [/npg_[A-Za-z0-9]{8,}/, 'password Neon'],
    [/postgres(ql)?:\/\/[^\s'"]+:[^\s'"@]+@/, 'connection string berkredensial'],
  ];
  const bocor = nilaiRahasia.filter(([re]) => re.test(gl)).map(([, label]) => label);
  if (bocor.length) {
    fail(`.gitleaks.toml memuat nilai rahasia di allowlist: ${bocor.join(', ')}`,
         'Kecualikan COMMIT-nya (commits = [...]), bukan nilai rahasianya');
  } else {
    ok('.gitleaks.toml tidak mendaftar-putihkan nilai rahasia');
  }
} catch {
  warn('.gitleaks.toml tidak ditemukan', 'Pemindaian rahasia di CI tidak aktif');
}

// 5b. Socket.IO tidak boleh menerima origin mana pun.
// 5c. Endpoint autentikasi harus punya pembatas laju sendiri (anti brute force).
try {
  const srv = fs.readFileSync(path.join(ROOT, 'server.ts'), 'utf8');

  if (/cors:\s*\{[^}]*origin:\s*["']\*["']/.test(srv)) {
    fail('Socket.IO menerima origin mana pun (origin: "*")',
         'Batasi ke daftar origin yang diizinkan');
  } else {
    ok('Socket.IO memakai daftar origin terbatas');
  }

  // Memeriksa invariannya, bukan nama variabelnya: setiap endpoint auth harus
  // dipasangi middleware pembatas laju lewat app.use.
  //
  // Versi pertama cek ini mencari nama harfiah "authLimiter" dan langsung salah
  // lapor begitu variabelnya dipecah menjadi loginLimiter dan registerLimiter,
  // padahal proteksinya justru bertambah kuat.
  const endpointAuth = [
    ['/api/auth/login', 'login'],
    ['/api/auth/register', 'register'],
  ];
  const tanpaPembatas = endpointAuth.filter(([path]) => {
    const re = new RegExp(
      'app\\.use\\(\\s*(?:\\[[^\\]]*)?["\']' + path.replace(/\//g, '\\/') + '["\'][^)]*?[A-Za-z_$][\\w$]*[Ll]imiter',
    );
    return !re.test(srv);
  });
  if (tanpaPembatas.length === 0) {
    ok('Endpoint autentikasi punya pembatas laju sendiri');
  } else {
    fail(`Endpoint tanpa pembatas laju: ${tanpaPembatas.map(([, n]) => n).join(', ')}`,
         'Pasang middleware rateLimit lewat app.use pada endpoint tersebut');
  }
} catch {
  warn('server.ts tidak terbaca, pemeriksaan konfigurasi dilewati');
}

// ── 6. Koneksi database sungguhan ─────────────────────────────────
section('6. Uji koneksi database');

(async () => {
  if (!process.env.DATABASE_URL) {
    fail('Dilewati — DATABASE_URL kosong');
  } else {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });
    const t0 = Date.now();
    try {
      const r = await pool.query('SELECT current_user AS u, current_database() AS d');
      ok(`Terhubung (${Date.now() - t0}ms)`, `user=${r.rows[0].u} db=${r.rows[0].d}`);
    } catch (e) {
      fail(`Tidak bisa connect: ${e.code || ''} ${e.message}`,
           e.code === '28P01'
             ? 'Password salah. Ambil ulang connection string dari console.neon.tech'
             : 'Cek koneksi internet dan status project di console.neon.tech');
    } finally {
      await pool.end().catch(() => {});
    }
  }

  // ── Ringkasan ───────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(58));
  if (failed === 0 && warned === 0) {
    console.log(`${c.green}${c.bold}SIAP JALAN.${c.reset} Semua pemeriksaan lolos.`);
    console.log(`${c.dim}Jalankan aplikasi: npm run dev${c.reset}`);
  } else if (failed === 0) {
    console.log(`${c.yellow}${c.bold}SIAP JALAN, dengan ${warned} peringatan.${c.reset}`);
    console.log(`${c.dim}Aplikasi bisa dijalankan, tapi sebaiknya peringatan di atas ditindaklanjuti.${c.reset}`);
  } else {
    console.log(`${c.red}${c.bold}BELUM SIAP: ${failed} masalah${c.reset}${warned ? `, ${warned} peringatan` : ''}.`);
    console.log(`${c.dim}Perbaiki baris bertanda GAGAL di atas, lalu jalankan lagi: npm run doctor${c.reset}`);
  }
  console.log('─'.repeat(58));

  process.exit(failed > 0 ? 1 : 0);
})();
