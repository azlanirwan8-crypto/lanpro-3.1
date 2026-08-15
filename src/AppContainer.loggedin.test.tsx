/**
 * Test render AppContainer pada jalur SUDAH LOGIN.
 *
 * ALASAN TEST INI ADA: sampai sekarang satu-satunya test render AppContainer
 * hanya menempuh jalur BELUM login — yang berhenti di layar Sign In dan tidak
 * pernah menyentuh sidebar, header, routing tampilan, maupun ratusan handler
 * di dalamnya. Padahal jalur itulah yang dipakai pengguna 99% waktu.
 *
 * Akibat nyata dari celah ini: beberapa perbaikan avatar pada sesi sebelumnya
 * terpaksa dicatat "belum teruji runtime" karena tidak ada cara memverifikasinya
 * selain membuka browser dan login secara manual.
 *
 * Pendekatannya sengaja menempuh JALUR PEMULIHAN SESI YANG SEBENARNYA:
 * AppContainer membaca `sessionUser` dari storage lalu memanggil
 * setIsLoggedIn(true). Test menyemai storage itu, bukan memalsukan useAuth —
 * sehingga kode yang dijalankan benar-benar kode produksi.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

// Socket.IO membuka koneksi sungguhan dan menahan proses Jest tetap hidup.
jest.mock("socket.io-client", () => ({
  __esModule: true,
  default: () => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connect: jest.fn(),
    io: { on: jest.fn(), off: jest.fn() },
    connected: false,
    id: "test-socket",
  }),
}));

jest.mock("html-to-image", () => ({ toJpeg: jest.fn() }));

// Satu titik isolasi jaringan: seluruh services memakai apiRequest.
jest.mock("./lib/api", () => {
  const asli = jest.requireActual("./lib/api");
  return { ...asli, apiRequest: jest.fn() };
});

import App from "./App";
import { AuthNotificationProvider } from "./components/AuthToastContainer";
import { apiRequest } from "./lib/api";

const PENGGUNA_UJI = {
  id: "1",
  uid: "1",
  username: "penguji",
  displayName: "Pengguna Uji",
  email: "penguji@lanpro.test",
  role: "admin",
  status: "active",
};

describe("AppContainer — jalur sudah login", () => {
  beforeEach(() => {
    // jest.config.cjs memakai resetMocks: true, sehingga implementasi WAJIB
    // dipasang di sini, bukan di dalam factory jest.mock.
    (apiRequest as jest.Mock).mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.includes("/api/auth/verify")) {
        return { status: "success", user: PENGGUNA_UJI };
      }
      return { status: "success", data: [] };
    });

    localStorage.setItem("lanpro_jwt_token", "token-uji");
    localStorage.setItem("sessionUser", JSON.stringify(PENGGUNA_UJI));
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const tampilkan = () =>
    render(
      <AuthNotificationProvider>
        <App />
      </AuthNotificationProvider>
    );

  it("ter-mount tanpa memicu error boundary", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => tampilkan()).not.toThrow();

    // React melaporkan kegagalan render lewat console.error, bukan lewat
    // lemparan yang bisa ditangkap di atas. Tanpa pemeriksaan ini komponen
    // yang crash tetap lolos.
    await waitFor(() => {
      const gagal = errorSpy.mock.calls.filter((c) =>
        String(c[0]).includes("The above error occurred")
      );
      expect(gagal).toHaveLength(0);
    });

    errorSpy.mockRestore();
  });

  it("menampilkan kerangka aplikasi, BUKAN layar login", async () => {
    tampilkan();

    // Menu sidebar hanya ada setelah login. Assertion pada isi nyata, bukan
    // sekadar "body tidak kosong" — pemeriksaan longgar akan tetap hijau meski
    // yang ter-render hanyalah error boundary.
    await waitFor(
      () => {
        expect(screen.getByText("Dashboard")).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(screen.queryByText(/Sign in to continue to LanPro Workspace/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/React Render Crash/i)).not.toBeInTheDocument();
  });

  it("memulihkan sesi dari storage tanpa memanggil layar login", async () => {
    tampilkan();

    await waitFor(() => expect(screen.getByText("Dashboard")).toBeInTheDocument(), {
      timeout: 5000,
    });

    // Identitas pengguna yang dipulihkan benar-benar dipakai untuk merender.
    expect(screen.getAllByText(/Pengguna Uji|penguji/i).length).toBeGreaterThan(0);
  });
});
