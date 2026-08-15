/**
 * Lokasi direktori unggahan.
 *
 * Di lingkungan serverless (Vercel, Lambda) satu-satunya direktori yang bisa
 * ditulis adalah /tmp, sehingga jalurnya berbeda dari mesin biasa. Nilai ini
 * dulunya disalin apa adanya di beberapa berkas rute; menaruhnya di satu tempat
 * mencegah keduanya menyimpang tanpa disadari.
 *
 * Catatan: file.routes.ts dan user.routes.ts masih memuat salinannya
 * masing-masing. Keduanya di luar lingkup perubahan ini dan sebaiknya
 * diarahkan ke sini pada pekerjaan tersendiri.
 */
import path from 'path';

export const isServerless =
  !!process.env.VERCEL ||
  !!process.env.AWS_EXECUTION_ENV ||
  process.cwd() === '/var/task' ||
  process.cwd().includes('/var/task');

export const GLOBAL_UPLOADS_DIR = isServerless
  ? '/tmp/uploads'
  : path.join(process.cwd(), 'uploads');
