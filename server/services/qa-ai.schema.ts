/**
 * Skema respons Gemini untuk fitur QA.
 *
 * Data statis murni: hanya bentuk objek yang diminta dari model. Sebelumnya
 * tertulis inline di tengah handler, masing-masing sepanjang puluhan baris,
 * sehingga alur handler-nya sulit diikuti.
 *
 * Dipindah apa adanya. Mengubah skema di sini berarti mengubah bentuk JSON yang
 * dikembalikan model, jadi perubahannya berpasangan dengan pemetaan hasil di
 * handler masing-masing.
 */
import { Type } from '@google/genai';

/** Perbaikan satu skenario uji: deskripsi, hasil yang diharapkan, dan langkah. */
export const QA_SCENARIO_REFINEMENT_SCHEMA =             {
              type: Type.OBJECT,
              properties: {
                deskripsi: {
                  type: Type.STRING,
                  description:
                    "Deskripsi skenario uji yang telah diperbaiki, rapi, dan profesional (dalam Bahasa Indonesia).",
                },
                expected: {
                  type: Type.STRING,
                  description:
                    "Hasil akhir yang diharapkan secara keseluruhan dari skenario uji ini (dalam Bahasa Indonesia).",
                },
                steps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: {
                        type: Type.STRING,
                        description: "Nomor langkah berurutan (misal '1', '2', '3')",
                      },
                      action: {
                        type: Type.STRING,
                        description:
                          "Tindakan pengujian yang harus dilakukan oleh tester (dalam Bahasa Indonesia)",
                      },
                      expectedResult: {
                        type: Type.STRING,
                        description:
                          "Hasil spesifik yang diharapkan dari tindakan tersebut (dalam Bahasa Indonesia)",
                      },
                    },
                    required: ["id", "action", "expectedResult"],
                  },
                  description: "Daftar langkah pengujian berurutan.",
                },
              },
              required: ["deskripsi", "expected", "steps"],
            };

/** Daftar rekomendasi test case hasil analisis AI. */
export const QA_TEST_CASE_SUGGESTION_SCHEMA =             {
              type: Type.ARRAY,
              description: "Daftar rekomendasi test case hasil analisis AI",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: {
                    type: Type.STRING,
                    description:
                      "Judul skenario pengujian singkat dan spesifik",
                  },
                  description: {
                    type: Type.STRING,
                    description:
                      "Deskripsi detail mengenai apa yang diuji dan tujuannya",
                  },
                  fase: {
                    type: Type.STRING,
                    description: "Fase testing (SIT, UAT, atau PTR)",
                    enum: ["SIT", "UAT", "PTR"],
                  },
                  steps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description:
                      "Daftar langkah-langkah konkret pengujian yang harus dijalankan",
                  },
                  expected_result: {
                    type: Type.STRING,
                    description:
                      "Hasil akhir yang diharapkan secara keseluruhan setelah langkah-langkah di atas dijalankan",
                  },
                  priority: {
                    type: Type.STRING,
                    description:
                      "Prioritas pengujian (HIGH, MEDIUM, atau LOW)",
                    enum: ["HIGH", "MEDIUM", "LOW"],
                  },
                },
                required: [
                  "title",
                  "description",
                  "fase",
                  "steps",
                  "expected_result",
                  "priority",
                ],
              },
            };
