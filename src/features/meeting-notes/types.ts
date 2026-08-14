/**
 * Tipe domain AI Meeting Companion.
 *
 * Diekstrak apa adanya dari AiMeetingCompanion.tsx (Fase 3 — Anti-God-Object).
 * Tipe murni: tanpa React, tanpa efek samping, tanpa dependensi runtime.
 */

import type { Meeting, UserProfile } from '../../types';

export interface AiMeetingCompanionProps {
  projectId: string;
  meeting: Meeting;
  currentUser: UserProfile | null;
  projectMembers?: UserProfile[];
  onPointsImported?: () => void;
}

export interface TopicChronology {
  topik: string;
  pembahasan: string;
}

export interface ActionItem {
  concern: string;
  fitur?: string;
  system?: string;
  surrounding?: string;
  keterangan?: string;
  tindakanLanjut: string;
  PIC?: string;
  targetDate?: string;
}

export interface NextPlanItem {
  tahapan: string;
  deskripsi: string;
  estimasi_waktu?: string;
}

export interface ToBeScenario {
  kondisi_sekarang: string;
  target_ke_depan: string;
  langkah_transisi: string[];
}

export interface KronologiDanKesimpulanItem {
  topik_bahasan: string;
  latar_belakang_argumen: string;
  keputusan_akhir: string;
}

export interface TindakLanjutDanConcernItem {
  pembicara: string;
  kekhawatiran_spesifik: string;
  solusi_dan_arahan: string;
}

export interface NextPlanRoadmapItem {
  action_item: string;
  pic: string;
  estimasi_waktu: string;
}

export interface TargetToBeArchitecture {
  proses_bisnis_as_is: string;
  proses_bisnis_to_be: string;
  langkah_transisi: string[];
}

export interface AiSummaryStructure {
  ringkasan_eksekutif?: string;
  kronologi_dan_kesimpulan?: KronologiDanKesimpulanItem[];
  tindak_lanjut_dan_concern?: TindakLanjutDanConcernItem[];
  next_plan_roadmap?: NextPlanRoadmapItem[];
  target_to_be_architecture?: TargetToBeArchitecture;

  // Legacy fallback fields so older meetings don't crash
  notulen_rapat: TopicChronology[];
  kesimpulan: string[];
  saran: string[];
  meeting_metadata: {
    topik_utama: string;
    tanggal_waktu?: string;
    peserta_aktif: string[];
  };
  poin_diskusi_tambahan: ActionItem[];
  next_plan?: NextPlanItem[];
  to_be_scenario?: ToBeScenario;
}
