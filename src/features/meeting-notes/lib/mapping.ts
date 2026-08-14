/**
 * Pemetaan data hasil analisis AI ke bentuk yang dipakai UI.
 *
 * Diekstrak apa adanya dari AiMeetingCompanion.tsx (Fase 3 — Anti-God-Object).
 *
 * Fungsi murni: menerima data mentah dari backend, mengembalikan objek baru.
 * Tidak menyentuh React, state, DOM, maupun jaringan — sehingga bisa diuji
 * langsung tanpa merender apa pun.
 *
 * Menangani DUA bentuk data sekaligus: format baru (bertanda tab_ringkasan)
 * dan format lama, sehingga rapat yang dianalisis sebelum perubahan skema
 * tetap dapat ditampilkan.
 */

export const mapToActiveMeetingData = (data: any) => {
  if (!data) return null;
  
  // If already in the new format
  if (data.tab_ringkasan) {
    return {
      tab_ringkasan: data.tab_ringkasan,
      tab_kronologi_rapat: data.tab_kronologi_rapat || [],
      tab_kesimpulan: data.tab_kesimpulan || [],
      tab_saran_dan_ide: data.tab_saran_dan_ide || [],
      tab_tindak_lanjut: data.tab_tindak_lanjut || [],
      tab_next_plan: data.tab_next_plan || [],
      tab_target_to_be: data.tab_target_to_be || { proses_bisnis_as_is: "", proses_bisnis_to_be: "", langkah_transisi: [] },
      tab_metadata: data.tab_metadata || { host_rapat: "Host", tanggal_rapat: "", durasi_detik: 0, platform_digunakan: "Zoom", peserta_rapat: [] }
    };
  }

  // Else, synthesize from older format keys
  const topik_utama = data.meeting_metadata?.topik_utama || "Koordinasi Proyek";
  const ringkasan = data.ringkasan_eksekutif || "Tidak ada ringkasan.";
  
  const tab_ringkasan = {
    topik_utama,
    executive_summary_multimodal: ringkasan
  };

  const tab_kronologi_rapat = (data.kronologi_dan_kesimpulan || data.notulen_rapat || []).map((item: any) => ({
    timestamp: item.topik_bahasan?.match(/\[(\d+:\d+)\]/)?.[1] || "00:00",
    aktivitas_visual: item.topik_bahasan?.replace(/\[\d+:\d+\]\s*(Visual:\s*)?/, "") || item.topik || "Presentasi",
    isi_percakapan_inti: item.latar_belakang_argumen || item.pembahasan || ""
  }));

  const tab_kesimpulan = data.kesimpulan || [];

  const tab_saran_dan_ide = (data.saran || []).map((item: string) => {
    const parts = item.split(":");
    return {
      diusulkan_oleh: parts[0]?.trim() || "Pembicara",
      deskripsi_ide: parts.slice(1).join(":")?.trim() || item
    };
  });

  const tab_tindak_lanjut = (data.tindak_lanjut_dan_concern || data.poin_diskusi_tambahan || []).map((item: any) => ({
    concern_masalah: item.kekhawatiran_spesifik || item.concern || "",
    solusi_disepakati: item.solusi_dan_arahan || item.tindakanLanjut || ""
  }));

  const tab_next_plan = (data.next_plan_roadmap || data.next_plan || []).map((item: any) => ({
    action_item: item.action_item || item.tahapan || "",
    pic: item.pic || "TBD",
    due_date: item.estimasi_waktu || "TBD"
  }));

  const tab_target_to_be = {
    proses_bisnis_as_is: data.target_to_be_architecture?.proses_bisnis_as_is || data.to_be_scenario?.kondisi_sekarang || "",
    proses_bisnis_to_be: data.target_to_be_architecture?.proses_bisnis_to_be || data.to_be_scenario?.target_ke_depan || "",
    langkah_transisi: data.target_to_be_architecture?.langkah_transisi || data.to_be_scenario?.langkah_transisi || []
  };

  const tab_metadata = {
    host_rapat: "Host",
    tanggal_rapat: data.meeting_metadata?.tanggal_waktu || "",
    durasi_detik: 0,
    platform_digunakan: "Zoom",
    peserta_rapat: data.meeting_metadata?.peserta_aktif || []
  };

  return {
    tab_ringkasan,
    tab_kronologi_rapat,
    tab_kesimpulan,
    tab_saran_dan_ide,
    tab_tindak_lanjut,
    tab_next_plan,
    tab_target_to_be,
    tab_metadata
  };
};
