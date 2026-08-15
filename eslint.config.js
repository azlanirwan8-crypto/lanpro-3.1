/**
 * Konfigurasi ESLint.
 *
 * TUJUANNYA BUKAN GAYA PENULISAN — itu urusan Prettier. Aturan di sini
 * menegakkan hal-hal yang selama ini hanya tertulis di ARCHITECTURE.md dan
 * terbukti tidak bertahan:
 *
 *   "File maksimal 500 baris"        dilanggar 32 kali
 *   "Komponen lewat services/"       dilanggar 14 dari 21 fitur
 *   Lapisan controllers/             dibuat lalu kosong berbulan-bulan
 *
 * Dokumentasi tidak menegakkan apa pun. Mesin yang menegakkan.
 *
 * CATATAN PENTING soal tingkat keparahan: aturan struktural di bawah sengaja
 * dipasang sebagai "warn", BUKAN "error". Codebase ini punya 32 berkas di atas
 * 500 baris dan 13 pemanggilan backend dari komponen. Memasangnya sebagai
 * error hari ini membuat lint merah total dan justru akan diabaikan orang.
 *
 * Rencananya: pelanggaran BARU terlihat sebagai peringatan sekarang, lalu
 * dinaikkan menjadi error setelah utang yang ada dilunasi (lihat fase L3-L4).
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**', 'dist/**', 'coverage/**', 'uploads/**',
      'shims/**', 'scripts/**', 'docs/**', '*.config.js', '*.config.cjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly', document: 'readonly', console: 'readonly',
        process: 'readonly', fetch: 'readonly', localStorage: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly',
        clearInterval: 'readonly', FormData: 'readonly', Blob: 'readonly',
        URL: 'readonly', Image: 'readonly', HTMLElement: 'readonly',
        __dirname: 'readonly', Buffer: 'readonly', React: 'readonly',
      },
    },
    rules: {
      /* Batas ukuran berkas — ARCHITECTURE.md §3.1 */
      'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],

      /* Longgar untuk kode yang sudah ada; ketat untuk yang baru ditulis. */
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none',
      }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-undef': 'off',
      'no-useless-escape': 'warn',
      '@typescript-eslint/no-require-imports': 'off',

      /* DINAIKKAN KE ERROR setelah utangnya lunas (fase L3).
       *
       * Ketiga aturan di bawah kini nol pelanggaran, sehingga aman dijadikan
       * penghalang: pelanggaran BARU akan gagal di pre-commit, bukan menumpuk
       * diam-diam seperti sebelumnya. */
      'no-empty-pattern': 'error',
      'no-shadow-restricted-names': 'error',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',

      /* UTANG GAYA WARISAN — masih warn.
       *
       * Kedelapan aturan di bawah menyisakan 32 pelanggaran dari kode yang
       * ditulis sebelum ESLint ada. Sebagai error, keduanya menahan pre-commit
       * pada berkas mana pun yang kebetulan disentuh — termasuk perbaikan yang
       * sama sekali tidak berhubungan. Efeknya orang akan memakai --no-verify,
       * dan penegakan yang di-bypass sama saja dengan tidak ada.
       *
       * Aturan LAPISAN tetap error (lihat blok di bawah), karena itulah yang
       * benar-benar menjaga arsitektur. Kedelapan ini soal gaya, dan dilunasi
       * bertahap pada fase L3. */
      'no-case-declarations': 'warn',
      'prefer-const': 'warn',
      'no-prototype-builtins': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-namespace': 'warn',
      'no-constant-condition': 'warn',
    },
  },
  {
    /* ARATURAN LAPISAN — ARCHITECTURE.md §2.
     * Komponen tidak boleh bicara ke backend langsung. Selama ini aturan ini
     * hanya berupa kalimat; di sini ia menjadi pemeriksaan yang berjalan. */
    files: ['src/features/**/components/**/*.tsx', 'src/components/**/*.tsx'],
    rules: {
      /* ERROR, bukan warn. Hanya dua berkas lama yang melanggar dan keduanya
       * sudah ditandai eksplisit dengan eslint-disable beserta rujukan utang.
       * Dengan begini pelanggaran BARU benar-benar tertahan di pre-commit. */
      'no-restricted-imports': ['error', {
        paths: [{
          name: '../../lib/api',
          importNames: ['apiRequest'],
          message: 'Komponen tidak boleh memanggil backend langsung. Lewat services/ — lihat ARCHITECTURE.md §2.',
        }],
        patterns: [{
          group: ['**/lib/api'],
          importNames: ['apiRequest'],
          message: 'Komponen tidak boleh memanggil backend langsung. Lewat services/ — lihat ARCHITECTURE.md §2.',
        }],
      }],
    },
  },
  {
    /* lib/ berisi fungsi murni: tanpa React, tanpa jaringan. */
    files: ['src/features/**/lib/**/*.ts'],
    rules: {
      'no-restricted-imports': ['warn', {
        patterns: [
          { group: ['react'], message: 'lib/ harus fungsi murni, tanpa React — ARCHITECTURE.md §2.' },
          { group: ['**/lib/api'], message: 'lib/ tidak boleh menyentuh jaringan — ARCHITECTURE.md §2.' },
        ],
      }],
    },
  },
  {
    /* Berkas test bebas dari batas ukuran dan aturan lapisan. */
    files: ['**/*.test.ts', '**/*.test.tsx', 'src/test/**'],
    rules: { 'max-lines': 'off', 'no-restricted-imports': 'off' },
  },
);
