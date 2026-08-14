/**
 * Lapisan akses data Flowchart.
 *
 * Diekstrak dari FlowchartContainer.tsx (Fase 3 — Anti-God-Object).
 *
 * Satu-satunya tempat komponen Flowchart berbicara dengan backend. Komponen
 * tidak lagi menyusun URL atau membentuk body request sendiri.
 *
 * Flowchart disimpan di tabel Documents dengan `type: "flowchart"`; struktur
 * node dan edge-nya diserialisasi sebagai JSON ke dalam kolom `description`.
 * Detail penyandian itu sengaja dikurung di file ini.
 */

import { apiRequest } from '../../../lib/api';
import type { FlowchartData } from '../types';

/** Bentuk baris Documents yang dikembalikan backend. */
interface DocumentRow {
  id: string;
  title: string;
  description?: string;
  type?: string;
  link?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Membongkar node/edge yang tersimpan sebagai JSON di kolom description. */
function parseFlowPayload(description?: string): { nodes: any[]; edges: any[] } {
  try {
    const payload = JSON.parse(description || '{}');
    return { nodes: payload.nodes || [], edges: payload.edges || [] };
  } catch {
    // Deskripsi lama bisa berupa teks biasa, bukan JSON. Perlakukan sebagai kosong.
    return { nodes: [], edges: [] };
  }
}

/** Mengubah baris Documents menjadi FlowchartData yang dipakai UI. */
function toFlowchartData(doc: DocumentRow): FlowchartData {
  const { nodes, edges } = parseFlowPayload(doc.description);
  return {
    id: doc.id,
    name: doc.title,
    category: 'Panduan',
    description: doc.description ?? '',
    nodes,
    edges,
    theme: 'miro',
    createdAt: doc.createdAt
      ? new Date(doc.createdAt).toLocaleDateString('id-ID')
      : new Date().toLocaleDateString('id-ID'),
    createdBy: doc.createdBy || 'Administrator',
    lastEditedAt: doc.updatedAt
      ? new Date(doc.updatedAt).toLocaleString('id-ID')
      : new Date().toLocaleString('id-ID'),
    externalUrl: doc.link || '',
  };
}

/** Menyandikan node/edge menjadi payload description. */
function encodeFlowPayload(flow: Pick<FlowchartData, 'nodes' | 'edges'>): string {
  return JSON.stringify({ nodes: flow.nodes, edges: flow.edges });
}

/**
 * Mengambil seluruh flowchart milik sebuah proyek.
 * Mengembalikan array kosong bila backend tidak mengirim data yang valid.
 */
export async function fetchFlowcharts(projectId: string): Promise<FlowchartData[]> {
  const res: any = await apiRequest(`/api/projects/${projectId}/documents`);
  if (!res?.data || !Array.isArray(res.data)) return [];
  return res.data
    .filter((doc: DocumentRow) => doc.type === 'flowchart')
    .map(toFlowchartData);
}

/** Membuat flowchart baru di backend. */
export async function createFlowchart(
  projectId: string,
  flow: Pick<FlowchartData, 'name' | 'nodes' | 'edges' | 'externalUrl' | 'createdBy'>,
): Promise<void> {
  await apiRequest(`/api/projects/${projectId}/documents`, {
    method: 'POST',
    body: {
      title: flow.name,
      description: encodeFlowPayload(flow),
      type: 'flowchart',
      link: flow.externalUrl || null,
      createdBy: flow.createdBy,
    },
  });
}

/** Memperbarui metadata dan isi flowchart yang sudah ada. */
export async function updateFlowchart(
  projectId: string,
  flowId: string,
  data: { name: string; nodes: any[]; edges: any[]; externalUrl?: string },
): Promise<void> {
  await apiRequest(`/api/projects/${projectId}/documents/${flowId}`, {
    method: 'PUT',
    body: {
      title: data.name,
      description: encodeFlowPayload({ nodes: data.nodes, edges: data.edges }),
      link: data.externalUrl || null,
    },
  });
}

/** Menghapus flowchart di backend. */
export async function deleteFlowchart(projectId: string, flowId: string): Promise<void> {
  await apiRequest(`/api/projects/${projectId}/documents/${flowId}`, {
    method: 'DELETE',
  });
}
