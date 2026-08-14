/**
 * Stub generik untuk paket yang hanya diterbitkan sebagai ESM.
 *
 * Jest menjalankan test sebagai CommonJS, sehingga `require()` atas paket ESM
 * murni gagal dengan "Unexpected token 'export'". Menambal satu per satu
 * memerlukan satu berkas mock untuk tiap paket, padahal isinya tidak pernah
 * dipakai test render.
 *
 * Proxy di bawah membalas SETIAP nama ekspor dengan fungsi no-op yang aman
 * dipakai sebagai tiga hal sekaligus:
 *   - komponen React   → mengembalikan null, jadi React tidak protes
 *   - konstruktor      → `new FFmpeg()` menghasilkan instance kosong
 *   - fungsi biasa     → `fetchFile()` mengembalikan undefined
 *
 * Artinya paket ESM baru cukup didaftarkan di `moduleNameMapper` tanpa menulis
 * mock baru. Bila suatu test perlu perilaku sungguhan dari salah satu paket,
 * paket itu harus dipetakan ke mock khususnya sendiri — bukan ke sini.
 */
function stub() {
  return null;
}

module.exports = new Proxy(
  { __esModule: true },
  {
    get(target, prop) {
      if (prop === '__esModule') return true;
      if (Object.prototype.hasOwnProperty.call(target, prop)) return target[prop];
      return stub;
    },
    has() {
      return true;
    },
  },
);
