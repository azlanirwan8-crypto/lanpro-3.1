/**
 * Tipe domain Wiki / Dokumentasi.
 *
 * Diekstrak dari index.tsx (Fase 3 — Anti-God-Object).
 * Tipe murni: tanpa React, tanpa efek samping, tanpa dependensi runtime.
 */

import type { UserProfile, MasterData } from '../../types';

/** Satu baris pada tabel Documents. */
export interface DocumentModel {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  type: string;
  link: string;
  fileName: string;
  fileType: string;
  createdBy: string;
  downloadCount?: number;
  createdAt: any;
  updatedAt: any;
}

export interface WikiViewProps {
  projectId: string;
  users: UserProfile[];
  currentUser: UserProfile | null;
  masterData?: MasterData[];
}
