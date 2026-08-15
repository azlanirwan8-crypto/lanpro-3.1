/**
 * Skema respons Gemini untuk analisis rapat multimodal (video + audio).
 *
 * Data statis murni: hanya bentuk objek yang diminta dari model, tanpa satu pun
 * nilai runtime. Sebelumnya berada di tengah handler analyze-video sepanjang
 * hampir seratus baris, yang membuat alur handler itu sulit dibaca.
 *
 * Dipindah apa adanya. Mengubah skema ini berarti mengubah bentuk JSON yang
 * dikembalikan model, jadi perubahan di sini berpasangan dengan pemetaan hasil
 * di handler-nya.
 */
import { Type } from '@google/genai';

export const MULTIMODAL_ANALYSIS_SCHEMA = {
        type: Type.OBJECT,
        properties: {
          tab_ringkasan: {
            type: Type.OBJECT,
            properties: {
              topik_utama: { type: Type.STRING, description: "Topik utama dari rapat." },
              executive_summary_multimodal: { type: Type.STRING, description: "Narasi terpadu (1-2 paragraf) yang menggabungkan analisis bahan presentasi visual di layar dengan dinamika hasil diskusi suara secara mendalam." }
            },
            required: ["topik_utama", "executive_summary_multimodal"]
          },
          tab_kronologi_rapat: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                timestamp: { type: Type.STRING, description: "Waktu kejadian dalam format MM:SS." },
                aktivitas_visual: { type: Type.STRING, description: "Deskripsi objektif apa yang tampil/di-share di layar pada menit tersebut." },
                isi_percakapan_inti: { type: Type.STRING, description: "Poin perdebatan atau pembahasan verbal peserta rapat yang berkolerasi dengan tampilan layar." }
              },
              required: ["timestamp", "aktivitas_visual", "isi_percakapan_inti"]
            }
          },
          tab_kesimpulan: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Daftar pernyataan kesimpulan atau keputusan final rapat secara riil."
          },
          tab_saran_dan_ide: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                diusulkan_oleh: { type: Type.STRING, description: "Nama atau kode pembicara yang mengusulkan gagasan tersebut." },
                deskripsi_ide: { type: Type.STRING, description: "Gagasan, inovasi, atau alternatif solusi yang dilontarkan dalam diskusi untuk pengembangan ke depan." }
              },
              required: ["diusulkan_oleh", "deskripsi_ide"]
            }
          },
          tab_tindak_lanjut: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                concern_masalah: { type: Type.STRING, description: "Kekhawatiran spesifik atau gap sistem yang diangkat pembicara." },
                solusi_disepakati: { type: Type.STRING, description: "Mandat tindakan penanggulangan yang diputuskan dalam rapat." }
              },
              required: ["concern_masalah", "solusi_disepakati"]
            }
          },
          tab_next_plan: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                action_item: { type: Type.STRING, description: "Tugas taktis spesifik." },
                pic: { type: Type.STRING, description: "Nama atau tim penanggung jawab riil. Jika tidak ada, tulis 'TBD'." },
                due_date: { type: Type.STRING, description: "Tanggal atau estimasi waktu eksplisit dari diskusi. Jika tidak ada, tulis 'TBD'." }
              },
              required: ["action_item", "pic", "due_date"]
            }
          },
          tab_target_to_be: {
            type: Type.OBJECT,
            properties: {
              proses_bisnis_as_is: { type: Type.STRING, description: "Detail kondisi sistem/proses manual saat ini berdasarkan presentasi/diskusi." },
              proses_bisnis_to_be: { type: Type.STRING, description: "Detail alur sistem/arsitektur target masa depan yang disepakati." },
              langkah_transisi: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Langkah-langkah transisi migrasi konkret."
              }
            },
            required: ["proses_bisnis_as_is", "proses_bisnis_to_be", "langkah_transisi"]
          },
          tab_metadata: {
            type: Type.OBJECT,
            properties: {
              host_rapat: { type: Type.STRING, description: "Nama pembawa acara atau host rapat." },
              tanggal_rapat: { type: Type.STRING, description: "Tanggal diadakannya rapat dalam format YYYY-MM-DD." },
              durasi_detik: { type: Type.INTEGER, description: "Durasi video/rapat dalam detik." },
              platform_digunakan: { type: Type.STRING, description: "Platform video conference, misal: 'Zoom', 'Teams', atau 'GMeet'." },
              peserta_rapat: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Daftar seluruh nama peserta rapat atau pembicara yang terdeteksi."
              }
            },
            required: ["host_rapat", "tanggal_rapat", "durasi_detik", "platform_digunakan", "peserta_rapat"]
          }
        },
        required: [
          "tab_ringkasan", "tab_kronologi_rapat", "tab_kesimpulan", "tab_saran_dan_ide",
          "tab_tindak_lanjut", "tab_next_plan", "tab_target_to_be", "tab_metadata"
        ]
      };
