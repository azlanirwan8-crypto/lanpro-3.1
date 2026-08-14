/**
 * Test render untuk FlowchartView.
 *
 * ALASAN TEST INI ADA: Fase 5 membelah ±2.400 baris JSX. Test render yang sudah
 * ada hanya me-mount AppContainer pada jalur BELUM login, sehingga FlowchartView
 * tidak pernah ikut ter-render — kerusakan di dalamnya tidak akan terdeteksi
 * oleh apa pun kecuali membuka browser dan login.
 *
 * Yang diuji: komponen bisa di-mount pada kedua tampilannya (daftar flowchart
 * dan kanvas editor) tanpa melempar. Bukan perilaku fiturnya. Nilainya ada pada
 * cakupan — pemindahan JSX yang merusak struktur akan gagal di sini.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { Project, Task } from '../../types';

// Lapisan service adalah satu-satunya jalur ke backend (ARCHITECTURE.md §2),
// jadi cukup satu titik ini yang perlu diisolasi agar test tidak menyentuh
// jaringan.
jest.mock('./services/flowchart.service', () => ({
  fetchFlowcharts: jest.fn(),
  createFlowchart: jest.fn(),
  updateFlowchart: jest.fn(),
  deleteFlowchart: jest.fn(),
}));

// html-to-image menyentuh canvas sungguhan yang tidak ada di jsdom, dan hanya
// dipakai saat pengguna menekan Export JPG.
jest.mock('html-to-image', () => ({ toJpeg: jest.fn().mockResolvedValue('') }));

import { FlowchartView } from './FlowchartContainer';
import {
  fetchFlowcharts,
  createFlowchart,
  updateFlowchart,
  deleteFlowchart,
} from './services/flowchart.service';

const project = { id: 'p1', name: 'Proyek Uji' } as Project;

const renderView = (over: Partial<React.ComponentProps<typeof FlowchartView>> = {}) =>
  render(
    <FlowchartView
      selectedProject={project}
      tasks={[] as Task[]}
      projectMembers={[]}
      setSelectedTaskForDetail={jest.fn()}
      setIsTaskDetailModalOpen={jest.fn()}
      currentUserProfile={{ id: 'u1', name: 'Administrator', role: 'admin' }}
      {...over}
    />,
  );

describe('FlowchartView', () => {
  // jest.config.cjs memasang `resetMocks: true`, yang menghapus implementasi
  // mock sebelum tiap test. Implementasi karena itu HARUS dipasang di sini,
  // bukan di dalam factory jest.mock di atas — kalau di sana, service akan
  // mengembalikan undefined dan komponen gagal pada `.then()`.
  beforeEach(() => {
    (fetchFlowcharts as jest.Mock).mockResolvedValue([]);
    (createFlowchart as jest.Mock).mockResolvedValue({});
    (updateFlowchart as jest.Mock).mockResolvedValue({});
    (deleteFlowchart as jest.Mock).mockResolvedValue(undefined);
  });

  it('ter-mount tanpa melempar dan tanpa memicu error boundary', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderView()).not.toThrow();

    // React melaporkan kegagalan render lewat console.error, bukan lewat
    // lemparan yang bisa ditangkap di atas. Tanpa pemeriksaan ini, komponen
    // yang crash tetap lolos.
    const renderErrors = errorSpy.mock.calls.filter((call) =>
      String(call[0]).includes('The above error occurred'),
    );
    expect(renderErrors).toHaveLength(0);

    errorSpy.mockRestore();
  });

  it('mengambil daftar flowchart milik proyek yang sedang dipilih', async () => {
    renderView();

    await waitFor(() => expect(fetchFlowcharts).toHaveBeenCalledWith('p1'));
  });

  it('menampilkan tampilan daftar, bukan pohon kosong', async () => {
    renderView();

    // Assertion pada isi nyata: "body tidak kosong" akan tetap hijau meski yang
    // ter-render hanya sisa kerangka.
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Flowchart Editor/i })).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Manage interactive diagrams, process flows/i),
    ).toBeInTheDocument();
  });

  // Tampilan kanvas adalah bagian yang dibelah pada Fase 5, jadi justru ia yang
  // paling perlu ikut ter-render. Editor menyala ketika sebuah baris flowchart
  // diklik, sehingga daftarnya perlu berisi satu entri.
  it('me-render kanvas editor setelah sebuah flowchart dibuka', async () => {
    (fetchFlowcharts as jest.Mock).mockResolvedValue([
      {
        id: 'fw1',
        name: 'Alur Onboarding',
        description: JSON.stringify({ nodes: [], edges: [] }),
        createdBy: 'Administrator',
        createdAt: '2026-08-01T00:00:00.000Z',
        lastEditedAt: '2026-08-10T00:00:00.000Z',
      },
    ]);

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    renderView();

    const baris = await screen.findByText('Alur Onboarding');
    fireEvent.click(baris);

    // Kerangka editor: hanya ada setelah sebuah flowchart dibuka.
    await waitFor(() =>
      expect(screen.getByText(/Back to Flowchart List/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Daftar Dokumen/i)).toBeInTheDocument();

    // Editor terbuka pada mode dokumen. Kanvasnya — bagian terbesar dari JSX
    // yang dibelah pada fase ini — baru ter-render setelah beralih ke
    // "Flow Diagram", jadi peralihan itu ikut dijalankan di sini.
    fireEvent.click(screen.getByText(/Flow Diagram/i));

    await waitFor(() =>
      expect(screen.getByTitle(/Snap to Grid|Snapping/i)).toBeInTheDocument(),
    );

    const renderErrors = errorSpy.mock.calls.filter((call) =>
      String(call[0]).includes('The above error occurred'),
    );
    expect(renderErrors).toHaveLength(0);

    errorSpy.mockRestore();
  });
});
