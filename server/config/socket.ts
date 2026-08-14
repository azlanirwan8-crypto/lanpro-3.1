import type { Server } from 'socket.io';

/**
 * Registry instance Socket.IO.
 *
 * Instance-nya dibuat di server.ts, tetapi dibutuhkan oleh modul route yang
 * di-import server.ts — meng-import balik dari server.ts akan membentuk
 * lingkaran dependensi. Modul kecil ini memutus lingkaran itu: server.ts
 * mendaftarkan instance-nya sekali saat startup, konsumen mengambilnya lewat
 * getSocketServer().
 *
 * Dipakai terutama oleh kode yang berjalan DI LUAR route handler — misalnya
 * runAIPipeline() di meetings.routes.ts yang berjalan sebagai proses latar
 * setelah response terkirim, sehingga tidak punya akses ke `req.io`.
 */

let ioInstance: Server | null = null;

/** Dipanggil sekali dari server.ts setelah Socket.IO dibuat. */
export function setSocketServer(instance: Server): void {
  ioInstance = instance;
}

/**
 * Mengembalikan instance Socket.IO, atau null bila belum terdaftar.
 *
 * Sengaja mengembalikan null alih-alih melempar: pemancaran event bersifat
 * pelengkap. Bila registry belum terisi (mis. saat unit test menjalankan route
 * tanpa server penuh), event cukup dilewati — jangan sampai menjatuhkan
 * request yang sedang berjalan.
 */
export function getSocketServer(): Server | null {
  return ioInstance;
}
