/**
 * Setup untuk proyek Jest "jsdom" (test yang me-render komponen React).
 *
 * jsdom hanya mengimplementasikan sebagian API browser. Yang di bawah ini
 * dipakai oleh dependensi UI (recharts, framer-motion, react-grid-layout,
 * sonner) dan akan melempar TypeError bila tidak disediakan — kegagalan yang
 * tidak ada hubungannya dengan kode yang sedang diuji.
 */
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// jsdom tidak memasang TextEncoder/TextDecoder sebagai global, padahal Node
// punya keduanya. jspdf (lewat fast-png → iobuffer) memakainya saat modul
// dimuat, sehingga tanpa ini import-nya gagal sebelum test sempat berjalan.
globalThis.TextEncoder ??= TextEncoder;
globalThis.TextDecoder ??= TextDecoder as unknown as typeof globalThis.TextDecoder;

// Dipakai komponen yang bereaksi pada tema/breakpoint.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// recharts dan react-grid-layout mengukur kontainernya lewat dua API ini.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class IntersectionObserverStub {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??=
  IntersectionObserverStub as unknown as typeof IntersectionObserver;

// jsdom tidak melakukan layout, jadi setiap elemen berukuran 0x0 dan recharts
// menolak menggambar. Beri ukuran tetap supaya grafik ikut ter-render.
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  value: 1024,
});
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  value: 768,
});

window.scrollTo = () => {};

// AppContainer memakai crypto.randomUUID untuk id sementara.
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      ...globalThis.crypto,
      randomUUID: () => '00000000-0000-4000-8000-000000000000',
    },
  });
}
