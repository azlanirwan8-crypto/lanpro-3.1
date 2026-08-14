/** Jest runs TS through ts-jest compiled to CommonJS (tsconfig.jest.json) regardless
 * of this package's "type": "module" — avoids ESM/Jest interop entirely.
 *
 * Dua proyek, karena keduanya butuh lingkungan yang berbeda:
 *
 *   node   — util, hook terisolasi, middleware, rute. Tidak menyentuh DOM.
 *   jsdom  — test yang benar-benar me-render komponen React.
 *
 * Pemilahannya lewat ekstensi: `*.test.ts` masuk node, `*.test.tsx` masuk jsdom.
 * Konvensi ini menjaga test lama berjalan persis seperti sebelumnya — jsdom
 * lebih lambat dan tidak ada gunanya untuk test yang tidak punya DOM.
 *
 * Catatan konfigurasi: `clearMocks`/`resetMocks`/`restoreMocks` adalah opsi
 * per-proyek, jadi ia harus berada di dalam tiap proyek. Bila ditaruh di akar
 * bersama `projects`, Jest mengabaikannya secara diam-diam.
 */
const shared = {
  rootDir: '.',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
  moduleNameMapper: {
    /** Berkas gaya bukan JavaScript; Vite yang biasanya menanganinya. */
    '\\.(css|scss|sass|less)$': '<rootDir>/src/test/styleMock.cjs',
    /* Paket berikut hanya diterbitkan sebagai ESM. Jest menjalankan test
     * sebagai CommonJS, sehingga `require()` atasnya gagal dengan
     * "Unexpected token 'export'". Ketimbang memaksa seluruh rantai unified
     * lewat transformer, keduanya diganti stub — perilakunya tidak relevan
     * bagi test render. */
    '^react-markdown$': '<rootDir>/src/test/mocks/reactMarkdown.tsx',
    '^remark-gfm$': '<rootDir>/src/test/mocks/esmStub.cjs',
    '^@ffmpeg/(ffmpeg|util)$': '<rootDir>/src/test/mocks/esmStub.cjs',
  },
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};

module.exports = {
  projects: [
    {
      ...shared,
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/server/**/*.test.ts'],
    },
    {
      ...shared,
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/**/*.test.tsx', '<rootDir>/server/**/*.test.tsx'],
      setupFilesAfterEnv: ['<rootDir>/src/test/setup.jsdom.ts'],
    },
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'server/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!server/**/*.test.{ts,tsx}',
    '!src/test/**',
    '!server/test/**',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/test/'],
};
