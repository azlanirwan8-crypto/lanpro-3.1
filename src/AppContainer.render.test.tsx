/**
 * Test render untuk AppContainer.
 *
 * ALASAN TEST INI ADA: pernah terjadi 28/28 test lolos dan `npm run build`
 * sukses, sementara AppContainer melempar ReferenceError saat render sehingga
 * seluruh UI diganti error boundary. Tidak ada test yang me-render komponen,
 * jadi tidak ada yang tahu. `GET /` tetap 200 karena yang terkirim hanya HTML
 * shell. Lihat ARCHITECTURE.md §3.3.
 *
 * Yang diuji di sini SATU hal: AppContainer bisa di-mount tanpa melempar.
 * Bukan perilaku fiturnya. Nilainya justru pada cakupan modulnya — dengan
 * me-mount pohon komponen sungguhan, kesalahan seperti temporal dead zone,
 * import yang bertabrakan, atau hook yang dipanggil bersyarat akan gagal di
 * sini alih-alih di browser pengguna.
 *
 * Susunan pembungkusnya sengaja meniru src/main.tsx. Bila main.tsx berubah,
 * berkas ini harus ikut berubah — kalau tidak, test menguji pohon yang tidak
 * pernah benar-benar dirender.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

// --- Isolasi jaringan -------------------------------------------------------
// Komponen tidak boleh menyentuh backend saat test. Socket.IO akan membuka
// koneksi sungguhan dan menahan proses Jest tetap hidup.
jest.mock('socket.io-client', () => ({
  __esModule: true,
  default: () => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connect: jest.fn(),
    io: { on: jest.fn(), off: jest.fn() },
    connected: false,
    id: 'test-socket',
  }),
}));

import App from './App';
import { AuthNotificationProvider } from './components/AuthToastContainer';

describe('AppContainer', () => {
  it('ter-mount tanpa melempar saat pengguna belum login', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(
        <AuthNotificationProvider>
          <App />
        </AuthNotificationProvider>,
      ),
    ).not.toThrow();

    // React menangkap kegagalan render di error boundary dan melaporkannya
    // lewat console.error, bukan lewat lemparan yang bisa ditangkap di atas.
    // Tanpa pemeriksaan ini, komponen yang crash tetap lolos.
    const renderErrors = errorSpy.mock.calls.filter((call) =>
      String(call[0]).includes('The above error occurred'),
    );
    expect(renderErrors).toHaveLength(0);

    errorSpy.mockRestore();
  });

  it('me-render layar login sungguhan, bukan pohon kosong', () => {
    render(
      <AuthNotificationProvider>
        <App />
      </AuthNotificationProvider>,
    );

    // Assertion pada isi nyata, bukan sekadar "ada sesuatu". Pemeriksaan
    // "body tidak kosong" akan tetap hijau meski yang ter-render hanyalah
    // error boundary — persis kegagalan yang test ini seharusnya tangkap.
    expect(screen.getByText(/Project Management Platform/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign in to continue to LanPro Workspace/i)).toBeInTheDocument();
  });

  it('tidak menampilkan error boundary', () => {
    render(
      <AuthNotificationProvider>
        <App />
      </AuthNotificationProvider>,
    );

    expect(screen.queryByText(/React Render Crash/i)).not.toBeInTheDocument();
  });
});
