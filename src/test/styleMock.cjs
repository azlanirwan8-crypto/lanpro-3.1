/**
 * Stub untuk import CSS/aset di bawah Jest.
 *
 * Vite menangani `import './sweetalert.css'` sebagai aset; Jest tidak bisa dan
 * akan mencoba mem-parse-nya sebagai JavaScript. Modul kosong ini menggantikan
 * berkas gaya lewat `moduleNameMapper` di jest.config.cjs.
 */
module.exports = {};
