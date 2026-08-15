/**
 * Test untuk penyaringan nilai avatar.
 *
 * Ditulis setelah audit produksi menemukan satu akun yang kolom avatarnya
 * berisi URL DOKUMEN lengkap dengan presigned token milik pengguna lain:
 *
 *   /uploads/ERD_PMB_1786608008193_81f1b53b8640.jpg?token=7acd...&uid=1
 *
 * Nilai itu masuk lewat PUT /api/users/:id yang dulu menulis apa pun dari body
 * request ke kolom avatar tanpa pemeriksaan. Kasus nyata itu dijadikan test
 * pertama di bawah supaya tidak bisa terulang tanpa ketahuan.
 */
import { sanitizeAvatarValue } from './user.routes';

describe('sanitizeAvatarValue', () => {
  it('menolak URL dokumen ber-presigned-token — kasus nyata dari produksi', () => {
    expect(
      sanitizeAvatarValue(
        '/uploads/ERD_PMB_1786608008193_81f1b53b8640.jpg?token=7acd39a8fd3e694f91488978e7b1263397373c718fc87a92aaf34c2ec3e33df0&uid=1'
      )
    ).toBeNull();
  });

  it('menerima jalur avatar sah yang dihasilkan endpoint unggah', () => {
    expect(sanitizeAvatarValue('/uploads/avatar-rido-1786770962706.jpg')).toBe(
      '/uploads/avatar-rido-1786770962706.jpg'
    );
    expect(sanitizeAvatarValue('/uploads/avatar-1-1786634777587.png')).toBe(
      '/uploads/avatar-1-1786634777587.png'
    );
    expect(
      sanitizeAvatarValue('/uploads/avatar-msrcihxm1pebtt5hnll-1786634758764.webp')
    ).toBe('/uploads/avatar-msrcihxm1pebtt5hnll-1786634758764.webp');
  });

  it('menolak berkas yang bukan avatar meski berada di uploads', () => {
    expect(sanitizeAvatarValue('/uploads/laporan-rahasia.pdf')).toBeNull();
    expect(sanitizeAvatarValue('/uploads/ERD_PMB_123.jpg')).toBeNull();
  });

  it('menolak ekstensi di luar daftar gambar yang diizinkan', () => {
    expect(sanitizeAvatarValue('/uploads/avatar-x-1.svg')).toBeNull();
    expect(sanitizeAvatarValue('/uploads/avatar-x-1.html')).toBeNull();
    expect(sanitizeAvatarValue('/uploads/avatar-x-1.exe')).toBeNull();
  });

  it('menolak query string dan fragment — di situlah token menumpang', () => {
    expect(sanitizeAvatarValue('/uploads/avatar-x-1.png?token=abc')).toBeNull();
    expect(sanitizeAvatarValue('/uploads/avatar-x-1.png#frag')).toBeNull();
  });

  it('menolak URL absolut dan protokol berbahaya', () => {
    expect(sanitizeAvatarValue('https://jahat.example/avatar-x.png')).toBeNull();
    expect(sanitizeAvatarValue('//jahat.example/avatar-x.png')).toBeNull();
    expect(sanitizeAvatarValue('javascript:alert(1)')).toBeNull();
    expect(sanitizeAvatarValue('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBeNull();
  });

  it('menolak upaya keluar direktori unggahan', () => {
    expect(sanitizeAvatarValue('/uploads/../../.env')).toBeNull();
    expect(sanitizeAvatarValue('/uploads/avatar-../../../etc/passwd.png')).toBeNull();
  });

  it('menolak nilai kosong dan tipe yang bukan string', () => {
    expect(sanitizeAvatarValue(null)).toBeNull();
    expect(sanitizeAvatarValue(undefined)).toBeNull();
    expect(sanitizeAvatarValue('')).toBeNull();
    expect(sanitizeAvatarValue('   ')).toBeNull();
    expect(sanitizeAvatarValue(123)).toBeNull();
    expect(sanitizeAvatarValue({})).toBeNull();
  });
});
