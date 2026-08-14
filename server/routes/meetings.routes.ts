/**
 * Meetings & Discussion Points Routes
 * Handles recording uploads, analysis, meeting management, and discussion points
 */

import { Router } from 'express';
import { authenticateJWT, verifyGlobalAdmin } from '../middleware/auth';
import { verifyProjectAccess } from '../middleware/rbac';
import mysqlPool from '../../src/lib/db';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { exec } from 'child_process';
import { TERMINAL_STATUSES } from '../../src/lib/constants';
import { generateBrdDocx } from '../services/docx.service';
import { validateFileBuffer, sanitizeFilename, generatePresignedUrl, verifyPresignedToken } from '../../src/lib/fileSecurity';
import taskRoutes from './task.routes';

const router = Router();

// Upload configuration
const isServerless = !!process.env.VERCEL || !!process.env.AWS_EXECUTION_ENV || process.cwd() === '/var/task' || process.cwd().includes('/var/task');
const GLOBAL_UPLOADS_DIR = isServerless ? '/tmp/uploads' : path.join(process.cwd(), 'uploads');
const upload = multer({ dest: GLOBAL_UPLOADS_DIR });

  router.post("/api/v1/meetings/:meetingId/upload-recording", upload.single('recording'), async (req, res) => {
    // Upload request received (debug log removed for production security)
    try {
      const { meetingId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ status: "error", message: "File tidak ditemukan." });
      }

      // Metadata parameter
      const { meeting_id, file_name, platform, chunkIndex, totalChunks, fileSize } = req.body;
      const targetMeetingId = meetingId || meeting_id;

      if (!targetMeetingId) {
        return res.status(400).json({ status: "error", message: "meeting_id tidak ditemukan dalam request." });
      }

      // Check if this is a chunked upload
      const isChunked = chunkIndex !== undefined && totalChunks !== undefined;

      if (isChunked) {
        const cIndex = parseInt(chunkIndex as string);
        const tChunks = parseInt(totalChunks as string);
        const originalSize = parseInt(fileSize as string) || file.size;

        if (isNaN(cIndex) || cIndex < 0 || cIndex >= tChunks) {
          return res.status(400).json({ status: "error", message: "Invalid chunk index or total chunks." });
        }
        if (isNaN(tChunks) || tChunks <= 0) {
          return res.status(400).json({ status: "error", message: "Invalid total chunks value." });
        }

        // Temporary directory for chunks
        const chunksDir = path.join(GLOBAL_UPLOADS_DIR, "chunks", targetMeetingId);
        if (!fs.existsSync(chunksDir)) {
          fs.mkdirSync(chunksDir, { recursive: true });
        }

        // Move chunk to chunksDir with the index as name
        const chunkPath = path.join(chunksDir, `chunk_${cIndex}`);
        fs.renameSync(file.path, chunkPath);

        // Check if all chunks have arrived
        let allChunksArrived = true;
        for (let i = 0; i < tChunks; i++) {
          const expectedPath = path.join(chunksDir, `chunk_${i}`);
          if (!fs.existsSync(expectedPath)) {
            allChunksArrived = false;
            break;
          }
        }

        if (allChunksArrived) {
          // Prevent concurrent merge by checking for a merge lock file
          const mergeLockPath = path.join(chunksDir, ".merging");
          if (fs.existsSync(mergeLockPath)) {
            return res.status(409).json({ status: "error", message: "Merge already in progress for this upload." });
          }

          // Create merge lock file
          fs.writeFileSync(mergeLockPath, Date.now().toString());

          const fileExt = path.extname(file_name || ".mp3") || ".mp3";
          const safeFileName = `recording_${targetMeetingId}_${Date.now()}${fileExt}`;
          const permanentPath = path.join(GLOBAL_UPLOADS_DIR, safeFileName);

          try {
            // Merge all chunks

            // Clear file if it exists
            if (fs.existsSync(permanentPath)) {
              fs.unlinkSync(permanentPath);
            }

            // Append each chunk synchronously to the target file
            for (let i = 0; i < tChunks; i++) {
              const expectedPath = path.join(chunksDir, `chunk_${i}`);
              const chunkBuffer = fs.readFileSync(expectedPath);
              fs.appendFileSync(permanentPath, chunkBuffer);
              // Delete chunk file immediately after reading
              fs.unlinkSync(expectedPath);
            }
          } finally {
            // Remove merge lock file
            try {
              fs.unlinkSync(mergeLockPath);
            } catch (err) {
              console.error("Failed to remove merge lock:", err);
            }
          }

          // Clean up chunks directory with proper error handling
          try {
            fs.rmdirSync(chunksDir);
            console.log(`[CLEANUP] Chunks directory deleted: ${chunksDir}`);
          } catch (rmErr: any) {
            console.error(`[CLEANUP_ERROR] Failed to delete chunks directory ${chunksDir}:`, rmErr.message);
            // Attempt to clean up remaining files before failing
            try {
              const files = fs.readdirSync(chunksDir);
              for (const file of files) {
                const filePath = path.join(chunksDir, file);
                try {
                  fs.unlinkSync(filePath);
                  console.log(`[CLEANUP] Removed orphaned file: ${filePath}`);
                } catch (fileErr: any) {
                  console.error(`[CLEANUP_ERROR] Failed to remove file ${filePath}:`, fileErr.message);
                }
              }
              // Retry directory deletion after cleaning up files
              fs.rmdirSync(chunksDir);
              console.log(`[CLEANUP] Chunks directory deleted after cleanup: ${chunksDir}`);
            } catch (cleanupErr: any) {
              console.error(`[CLEANUP_ERROR] Could not clean up chunks directory. Manual removal required: ${chunksDir}`, cleanupErr.message);
            }
          }

          // Security & Magic Byte Validation on the assembled file — the chunked
          // path skipped this entirely before, unlike the single-request path below.
          const mergedBuffer = fs.readFileSync(permanentPath);
          const mergedVal = validateFileBuffer(mergedBuffer, file_name || `recording${fileExt}`, 120 * 1024 * 1024);
          if (!mergedVal.valid) {
            if (fs.existsSync(permanentPath)) fs.unlinkSync(permanentPath);
            return res.status(400).json({
              status: "error",
              message: mergedVal.error || "Gagal Mengunggah Rekaman: Format file tidak didukung atau ukuran melebihi batas maksimum (Max 120MB)."
            });
          }

          // Construct relative production URL
          const recordingUrl = `/uploads/${safeFileName}`;

          // Commit update to Relational Database
          const connection = await mysqlPool.getConnection();
          await connection.query(
            "UPDATE Meetings SET recording_url = ?, file_size = ?, upload_status = 'UPLOAD_SUCCESS' WHERE id = ?",
            [recordingUrl, originalSize, targetMeetingId]
          );
          connection.release();

          // Trigger the asynchronous background AI worker! (runAIPipeline)
          runAIPipeline(targetMeetingId).catch((err) => {
            console.error(`[BACKGROUND PIPELINE START ERROR] for meeting ${targetMeetingId}:`, err);
          });

          // Return 201 Created with valid file metadata instantly to prevent timeouts
          return res.status(201).json({
            status: "success",
            completed: true,
            data: {
              meeting_id: targetMeetingId,
              recording_url: recordingUrl,
              file_size: originalSize,
              upload_status: 'UPLOAD_SUCCESS',
              file_name: file_name,
              platform: platform || "Zoom"
            }
          });
        } else {
          // Still uploading chunks, return success for this chunk
          return res.status(200).json({
            status: "success",
            completed: false,
            chunkIndex: cIndex,
            message: `Chunk ${cIndex + 1}/${tChunks} berhasil diunggah.`
          });
        }
      } else {
        // Security & Magic Byte Validation
        const fileBuf = fs.readFileSync(file.path);
        const fileVal = validateFileBuffer(fileBuf, file.originalname || file_name || "recording.mp3", 120 * 1024 * 1024);
        if (!fileVal.valid) {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          return res.status(400).json({ 
            status: "error", 
            message: fileVal.error || "Gagal Mengunggah Dokumen: Format file tidak didukung atau ukuran melebihi batas maksimum (Max 120MB)." 
          });
        }

        // Save permanently to local production storage: uploads/
        const safeFileName = fileVal.sanitizedName || sanitizeFilename(file.originalname || file_name || "recording.mp3");
        
        const permanentPath = path.join(GLOBAL_UPLOADS_DIR, safeFileName);
        
        // Copy to permanent folder and delete the temp file
        fs.copyFileSync(file.path, permanentPath);
        fs.unlinkSync(file.path);

        // Construct relative production URL
        const recordingUrl = `/uploads/${safeFileName}`;
        const fileSizeVal = file.size;

        // Commit update to Relational Database
        const connection = await mysqlPool.getConnection();
        await connection.query(
          "UPDATE Meetings SET recording_url = ?, file_size = ?, upload_status = 'UPLOAD_SUCCESS' WHERE id = ?",
          [recordingUrl, fileSizeVal, targetMeetingId]
        );
        connection.release();

        // Trigger the asynchronous background AI worker! (runAIPipeline)
        runAIPipeline(targetMeetingId).catch((err) => {
          console.error(`[BACKGROUND PIPELINE START ERROR] for meeting ${targetMeetingId}:`, err);
        });

        // Return 201 Created with valid file metadata instantly to prevent timeouts
        return res.status(201).json({
          status: "success",
          completed: true,
          data: {
            meeting_id: targetMeetingId,
            recording_url: recordingUrl,
            file_size: fileSizeVal,
            upload_status: 'UPLOAD_SUCCESS',
            file_name: file.originalname || file_name,
            platform: platform || "Zoom"
          }
        });
      }

    } catch (error: any) {
      console.error("POST /api/v1/meetings/:meetingId/upload-recording error:", error);
      return res.status(500).json({ status: "error", message: error.message || "Gagal mengunggah dan menyimpan rekaman." });
    }
  });

  router.post("/api/projects/:projectId/meetings/:id/upload-recording", (req, res) => {
    res.redirect(307, `/api/v1/meetings/${req.params.id}/upload-recording`);
  });

  // Background AI Worker for STT & LLM Pipeline (Non-blocking Asynchronous Execution)
  async function runAIPipeline(meetingId: string): Promise<void> {
    console.log(`[AI PIPELINE] Starting background processing for meeting: ${meetingId}`);
    let connection;
    try {
      connection = await mysqlPool.getConnection();
      
      // Set status to EXTRACTING_AUDIO
      await connection.query("UPDATE Meetings SET upload_status = 'EXTRACTING_AUDIO' WHERE id = ?", [meetingId]);
      io.emit("meeting_ai_status", { 
        meetingId, 
        status: "EXTRACTING_AUDIO",
        progress_percentage: 15,
        message: "Ekstraksi audio sedang berjalan..."
      });

      // Fetch meeting details
      const [rows]: any = await connection.query("SELECT * FROM Meetings WHERE id = ?", [meetingId]);
      if (!rows || rows.length === 0) {
        throw new Error(`Meeting dengan ID ${meetingId} tidak ditemukan.`);
      }
      
      const meeting = rows[0];
      const recordingUrl = meeting.recording_url;
      const meetingLink = meeting.meetingLink || "";

      if (!recordingUrl) {
        throw new Error("File rekaman belum diunggah atau tidak terdaftar di database.");
      }

      // Resolve file path
      const safeFileName = path.basename(recordingUrl);
      
      const filePath = path.join(GLOBAL_UPLOADS_DIR, safeFileName);

      if (!fs.existsSync(filePath)) {
        throw new Error(`File rekaman tidak ditemukan di path: ${filePath}`);
      }

      // Determine mime type from extension
      const fileExt = path.extname(filePath).toLowerCase();
      let mimeType = "audio/mp3";
      if (fileExt === ".wav") mimeType = "audio/wav";
      else if (fileExt === ".webm") mimeType = "audio/webm";
      else if (fileExt === ".m4a") mimeType = "audio/x-m4a";
      else if (fileExt === ".mp4") mimeType = "video/mp4";

      // 1. FFmpeg Audio Extraction
      let audioPath = filePath;
      let finalMimeType = mimeType;
      const isVideo = [".mp4", ".mkv", ".mov", ".avi", ".webm"].includes(fileExt);

      if (isVideo) {
        
        const extractedPath = path.join(GLOBAL_UPLOADS_DIR, `extracted_${meetingId}_${Date.now()}.mp3`);
        console.log(`[AI PIPELINE] Extracting audio from video file using FFmpeg: ${filePath} -> ${extractedPath}`);
        
        try {
          await new Promise<void>((resolve, reject) => {
            exec(`ffmpeg -y -i "${filePath}" -vn -acodec libmp3lame -ar 16000 -ac 1 "${extractedPath}"`, (err, stdout, stderr) => {
              if (err) {
                console.warn("[AI PIPELINE] FFmpeg execution failed, using original file:", err.message);
                reject(err);
              } else {
                console.log("[AI PIPELINE] FFmpeg extracted audio successfully.");
                resolve();
              }
            });
          });
          audioPath = extractedPath;
          finalMimeType = "audio/mp3";
        } catch (ffmpegErr) {
          console.warn("[AI PIPELINE] FFmpeg fallback activated. Direct processing.");
        }
      }

      // 2. Speech-to-Text using Gemini
      console.log(`[AI PIPELINE] Transcribing audio file: ${audioPath}`);
      await connection.query("UPDATE Meetings SET upload_status = 'TRANSCRIBING_STT' WHERE id = ?", [meetingId]);
      io.emit("meeting_ai_status", { 
        meetingId, 
        status: "TRANSCRIBING_STT",
        progress_percentage: 60,
        message: "Mengubah suara rekaman audio menjadi teks mentah secara akurat..."
      });

      const fileBuffer = fs.readFileSync(audioPath);
      const base64Audio = fileBuffer.toString('base64');

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Kunci API Gemini tidak dikonfigurasi.");
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const responseGemini = await generateContentWithFallback(ai, {
        model: "gemini-flash-latest",
        contents: [
          {
            inlineData: {
              data: base64Audio,
              mimeType: finalMimeType
            }
          },
          {
            text: "Transkripsikan seluruh isi rekaman audio rapat ini secara lengkap 100% dan sangat detail ke dalam Bahasa Indonesia. Pastikan tidak ada kata, kalimat, pembicara, atau alur pembahasan yang terpotong, disingkat, disederhanakan, atau dihilangkan. Berikan transkrip mentah yang utuh dari awal sampai akhir rapat."
          }
        ]
      });

      const transcriptText = responseGemini.text || "";
      if (!transcriptText.trim()) {
        throw new Error("Hasil transkrip audio kosong dari Gemini.");
      }

      console.log(`[AI PIPELINE] Transcript length: ${transcriptText.length} characters.`);
      await connection.query("UPDATE Meetings SET transcript = ? WHERE id = ?", [transcriptText, meetingId]);

      // 3. LLM Structured Analysis using Gemini SDK with Structured Outputs (responseSchema)
      console.log("[AI PIPELINE] Generating structured output analysis...");
      await connection.query("UPDATE Meetings SET upload_status = 'ANALYZING_LLM' WHERE id = ?", [meetingId]);
      io.emit("meeting_ai_status", { 
        meetingId, 
        status: "ANALYZING_LLM",
        progress_percentage: 90,
        message: "Mengekstrak rangkuman, keputusan, & rencana tindak lanjut dengan AI..."
      });
      
      const structuredSchema = {
        type: Type.OBJECT,
        properties: {
          ringkasan_eksekutif: { 
            type: Type.STRING, 
            description: "Bertindaklah sebagai Senior Business Analyst dan PMO Lead kelas enterprise yang sangat detail dan perfeksionis. Susun Notulen Rapat Profesional yang sangat detail secara UTUH, mendalam, dan TANPA meringkas/memotong poin penting dalam format Markdown. Patuhi instruksi ketat berikut:\n1. JANGAN lakukan enkapsulasi atau generalisasi (jangan meringkas perdebatan menjadi hanya satu kalimat jika di transkrip mereka berdiskusi panjang).\n2. Tuliskan semua studi kasus, nama brand/mitra, angka, estimasi bulan/target, dan istilah teknis secara verbatim (apa adanya sesuai transkrip).\n3. Jika ada perdebatan alur berpikir (misal: salah paham di awal lalu dikoreksi oleh pembicara lain), jabarkan kronologi koreksi tersebut di poin diskusi.\n\nGunakan struktur formatting berikut secara ketat:\n\n## NOTULEN RAPAT: [Nama Topik/Agenda Rapat Utama]\n**Tanggal:** [Isi Tanggal/Bulan/Tahun jika disebutkan]\n**Topik Utama:** [Tujuan besar rapat ini diadakan]\n\n---\n\n### **A. DAFTAR HADIR & IDENTIFIKASI PERAN**\n(Daftar semua pembicara beserta peran, divisi, atau latar belakang mereka berdasarkan isi percakapan).\n\n---\n\n### **B. KRONOLOGI DISKUSI MENDALAM & DETAIL TEKNIS**\n(Kupas habis setiap topik yang didebatkan. Bagi menjadi sub-heading (###) berdasarkan topik masalah. Masukkan detail arsitektur sistem, skema database/API/flow data, alasan bisnis di balik sebuah request, serta perbandingan sistem eksisting vs sistem baru yang dibahas).\n\n---\n\n### **C. BREAKDOWN RENCANA TINDAK LANJUT (ACTION ITEMS)**\n(Buat daftar tugas konkret yang sifatnya operasional dan siap dieksekusi, sebutkan:\n- Pihak/Tim Penanggung Jawab.\n- Detail Tugas (Langkah 1, Langkah 2, dst).\n- Dampak Teknis/Bisnis jika tugas ini dijalankan)."
          },
          kronologi_dan_kesimpulan: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                topik_bahasan: { type: Type.STRING, description: "Nama sub-topik spesifik yang diperdebatkan atau dibahas." },
                latar_belakang_argumen: { type: Type.STRING, description: "Detail penjelasan MENGAPA sub-topik ini dibahas dan argumen/pendapat yang disampaikan oleh para pembicara selama diskusi berjalan." },
                keputusan_akhir: { type: Type.STRING, description: "Pernyataan keputusan resmi yang disepakati bersama di akhir pembahasan sub-topik tersebut." }
              },
              required: ["topik_bahasan", "latar_belakang_argumen", "keputusan_akhir"]
            },
            description: "Daftar kronologi bahasan rapat beserta jalannya argumen dan keputusan akhir."
          },
          tindak_lanjut_dan_concern: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                pembicara: { type: Type.STRING, description: "Nama atau kode pembicara (Speaker ID) yang mengangkat isu / kekhawatiran spesifik." },
                kekhawatiran_spesifik: { type: Type.STRING, description: "Detail ketakutan, kendala teknis, atau gap sistem yang dikhawatirkan oleh pembicara tersebut secara mendalam." },
                solusi_dan_arahan: { type: Type.STRING, description: "Instruksi langsung, mandat, atau solusi penyelesaian masalah yang disepakati untuk memitigasi kekhawatiran tersebut." }
              },
              required: ["pembicara", "kekhawatiran_spesifik", "solusi_dan_arahan"]
            },
            description: "Daftar kekhawatiran spesifik dari pembicara beserta arahan/solusi penyelesaiannya."
          },
          next_plan_roadmap: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                action_item: { type: Type.STRING, description: "Deskripsi tugas taktis yang sangat spesifik dan detail (bukan kalimat pendek umum)." },
                pic: { type: Type.STRING, description: "Nama orang atau tim yang ditunjuk sebagai penanggung jawab. Jika tidak disebutkan di transkrip, gunakan 'TBD'." },
                estimasi_waktu: { type: Type.STRING, description: "Target tenggat waktu eksplisit dari transkrip. Jika tidak disebutkan, gunakan 'TBD'." }
              },
              required: ["action_item", "pic", "estimasi_waktu"]
            },
            description: "Roadmap rencana aksi taktis berikutnya."
          },
          target_to_be_architecture: {
            type: Type.OBJECT,
            properties: {
              proses_bisnis_as_is: { type: Type.STRING, description: "Detail gambaran alur kerja, sistem, atau prosedur operasional yang sedang berjalan saat ini (beserta kelemahannya jika ada)." },
              proses_bisnis_to_be: { type: Type.STRING, description: "Spesifikasi langkah demi langkah mengenai alur sistem baru, fitur baru, atau model operasional masa depan yang disepakati untuk dibangun." },
              langkah_transisi: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Langkah-langkah teknis atau operasional konkret untuk bermigrasi menuju kondisi target."
              }
            },
            required: ["proses_bisnis_as_is", "proses_bisnis_to_be", "langkah_transisi"],
            description: "Gambaran target arsitektur proses bisnis (As-Is vs To-Be)."
          }
        },
        required: [
          "ringkasan_eksekutif", "kronologi_dan_kesimpulan", "tindak_lanjut_dan_concern",
          "next_plan_roadmap", "target_to_be_architecture"
        ]
      };

      // 2.1 Dynamic Prompt Injection: Fetch latest 5-10 learning notes from ai_learning_logs
      let learningNotesStr = "";
      try {
        const [logs]: any = await connection.query(
          "SELECT evaluation_notes, timestamp FROM ai_learning_logs WHERE project_id = ? ORDER BY timestamp DESC LIMIT 10",
          [meeting.projectId]
        );
        if (logs && logs.length > 0) {
          learningNotesStr = logs.map((log: any, idx: number) => `[Evaluation #${idx + 1} - ${log.timestamp}]: ${log.evaluation_notes}`).join("\n");
        }
      } catch (logQueryErr) {
        console.warn("[AI PIPELINE] Gagal mengambil log evaluasi pembelajaran:", logQueryErr);
      }

      const learningSection = `
PANDUAN PENINGKATAN KEMAMPUAN ADAPTIF (SELF-IMPROVEMENT):
- Di bawah ini adalah daftar kritik dan catatan evaluasi dari user mengenai hasil kerja Anda pada rapat-rapat sebelumnya:
  ${learningNotesStr || "Tidak ada catatan evaluasi sebelumnya. Harap berikan hasil analisis terbaik dan detail secara konsisten."}

- TUGAS ANDA: Analisis kelemahan Anda berdasarkan catatan di atas. Jika user mengkritik Anda 'kurang detail pada aspek arsitektur', maka pada analisis rapat kali ini Anda WAJIB meningkatkan kedalaman informasi pada aspek arsitektur secara drastis.
- Selalu adaptasikan gaya penulisan notulen Anda agar semakin mendekati ekspektasi spesifik yang diminta oleh user dalam log evaluasi tersebut. Jangan ulangi kesalahan klasifikasi atau reduksi informasi yang sama.
`;

      const systemInstruction = `Bertindaklah sebagai Senior Business Analyst dan PMO Lead kelas enterprise yang sangat detail dan perfeksionis. Tugas Anda adalah menyusun Notulen Rapat Resmi yang sangat komprehensif, mendalam, detail secara UTUH dari Teks Transkrip Mentah (Raw Transcript) hasil rekaman rapat, dan TANPA meringkas/memotong poin penting.

Patuhi instruksi ketat berikut:
1. JANGAN lakukan enkapsulasi atau generalisasi (jangan meringkas perdebatan menjadi hanya satu kalimat jika di transkrip mereka berdiskusi panjang).
2. Tuliskan semua studi kasus, nama brand/mitra, angka, estimasi bulan/target, dan istilah teknis secara verbatim (apa adanya sesuai transkrip).
3. Jika ada perdebatan alur berpikir (misal: salah paham di awal lalu dikoreksi oleh pembicara lain), jabarkan kronologi koreksi tersebut di poin diskusi.

Anda WAJIB mematuhi Aturan Kepatuhan Faktual (Strict Grounding Rules) berikut:
1. HANYA ambil data yang tertulis atau diucapkan langsung di transkrip. Jangan mengarang fakta, tanggal, atau nama.
2. Jika nama pembicara (Speaker ID) teridentifikasi di transkrip, sertasikan nama/kode pembicara tersebut pada setiap poin analisis untuk akurasi rekam jejak.
3. Hasilkan output dalam format JSON terstruktur bersih tanpa bungkus blok markdown (JANGAN gunakan \`\`\`json ... \`\`\`).

Harap isi seluruh field dalam skema JSON terstruktur berikut secara lengkap:
- 'ringkasan_eksekutif': Notulen Rapat dari transkrip secara UTUH, mendalam, dan TANPA meringkas/memotong poin penting menggunakan struktur formatting Markdown berikut secara ketat:
  ## NOTULEN RAPAT: [Nama Topik/Agenda Rapat Utama]
  **Tanggal:** [Isi Tanggal/Bulan/Tahun jika disebutkan]
  **Topik Utama:** [Tujuan besar rapat ini diadakan]

  ---

  ### **A. DAFTAR HADIR & IDENTIFIKASI PERAN**
  (Daftar semua pembicara beserta peran, divisi, atau latar belakang mereka berdasarkan isi percakapan).

  ---

  ### **B. KRONOLOGI DISKUSI MENDALAM & DETAIL TEKNIS**
  (Kupas habis setiap topik yang didebatkan. Bagi menjadi sub-heading (###) berdasarkan topik masalah. Masukkan detail arsitektur sistem, skema database/API/flow data, alasan bisnis di balik sebuah request, serta perbandingan sistem eksisting vs sistem baru yang dibahas).

  ---

  ### **C. BREAKDOWN RENCANA TINDAK LANJUT (ACTION ITEMS)**
  (Buat daftar tugas konkret yang sifatnya operasional dan siap dieksekusi, sebutkan:
  - Pihak/Tim Penanggung Jawab.
  - Detail Tugas (Langkah 1, Langkah 2, dst).
  - Dampak Teknis/Bisnis jika tugas ini dijalankan).

- 'kronologi_dan_kesimpulan': kronologi jalannya pembahasan rapat terstruktur (topik_bahasan, latar_belakang_argumen, keputusan_akhir). Catat jalannya argumen dan perdebatan secara mendalam.
- 'tindak_lanjut_dan_concern': daftar kekhawatiran peserta rapat, kendala teknis atau gap sistem yang diungkapkan pembicara, beserta solusi/arahan langsung yang disepakati (pembicara, kekhawatiran_spesifik, solusi_dan_arahan).
- 'next_plan_roadmap': roadmap rencana aksi taktis hasil rapat yang spesifik dan detail (action_item, pic, estimasi_waktu).
- 'target_to_be_architecture': analisis skenario arsitektur masa depan yang disepakati (proses_bisnis_as_is, proses_bisnis_to_be, langkah_transisi).

${learningSection}`;

      const responseAnalysis = await generateContentWithFallback(ai, {
        model: "gemini-flash-latest",
        contents: `[TRANSKRIP RAPAT]:\n${transcriptText}`,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: structuredSchema
        }
      });

      const analysisJson = responseAnalysis.text ? responseAnalysis.text.trim() : "{}";
      let parsedData;
      try {
        parsedData = JSON.parse(analysisJson);
      } catch (parseErr) {
        console.error("Failed to parse meeting analysis JSON:", parseErr);
        parsedData = {};
      }

      // Synthesize legacy fields from the new corporate format to avoid breaking older meetings
      const ringkasan_eksekutif = parsedData.ringkasan_eksekutif || "";
      const kronologi_dan_kesimpulan = parsedData.kronologi_dan_kesimpulan || [];
      const tindak_lanjut_dan_concern = parsedData.tindak_lanjut_dan_concern || [];
      const next_plan_roadmap = parsedData.next_plan_roadmap || [];
      const target_to_be_architecture = parsedData.target_to_be_architecture || { proses_bisnis_as_is: "", proses_bisnis_to_be: "", langkah_transisi: [] };

      const kesimpulan = kronologi_dan_kesimpulan.map((item: any) => item.keputusan_akhir).filter(Boolean);
      const saran = tindak_lanjut_dan_concern.map((item: any) => `${item.pembicara || "TBD"}: ${item.solusi_dan_arahan || "TBD"}`).filter(Boolean);
      
      const notulen_rapat = kronologi_dan_kesimpulan.map((item: any, idx: number) => ({
        topik: item.topik_bahasan || `Topik Bahasan ${idx + 1}`,
        pembahasan: `Latar Belakang & Argumen:\n${item.latar_belakang_argumen || "Tidak disebutkan."}\n\nKeputusan Akhir:\n${item.keputusan_akhir || "Tidak disebutkan."}`
      }));

      const meeting_metadata = {
        topik_utama: ringkasan_eksekutif ? (ringkasan_eksekutif.split(".")[0] || "Koordinasi Proyek") : "Koordinasi Proyek",
        peserta_aktif: Array.from(new Set(tindak_lanjut_dan_concern.map((item: any) => item.pembicara).filter(Boolean))) as string[],
        tanggal_waktu: new Date().toLocaleDateString("id-ID")
      };

      const poin_diskusi_tambahan = tindak_lanjut_dan_concern.map((item: any) => ({
        concern: item.kekhawatiran_spesifik || "",
        tindakanLanjut: item.solusi_dan_arahan || "",
        PIC: item.pembicara || "TBD",
        targetDate: "TBD",
        fitur: "",
        system: "",
        surrounding: "",
        keterangan: ""
      }));

      const next_plan = next_plan_roadmap.map((item: any) => ({
        tahapan: item.action_item || "",
        deskripsi: `Ditugaskan kepada: ${item.pic || "TBD"}. Rencana Aksi: ${item.action_item}`,
        estimasi_waktu: item.estimasi_waktu || "Tidak disebutkan"
      }));

      const to_be_scenario = {
        kondisi_sekarang: target_to_be_architecture.proses_bisnis_as_is || "",
        target_ke_depan: target_to_be_architecture.proses_bisnis_to_be || "",
        langkah_transisi: target_to_be_architecture.langkah_transisi || []
      };

      // Create a combined JSON with old and new structures
      const combinedData = {
        ...parsedData,
        notulen_rapat,
        kesimpulan,
        saran,
        meeting_metadata,
        poin_diskusi_tambahan,
        next_plan,
        to_be_scenario
      };

      const finalJson = JSON.stringify(combinedData);

      // Save structured output to both analysis_result (LONGTEXT) and aiSummary (JSON) to avoid breakages
      await connection.query(
        "UPDATE Meetings SET aiSummary = ?, analysis_result = ?, upload_status = 'COMPLETED' WHERE id = ?",
        [finalJson, finalJson, meetingId]
      );

      console.log(`[AI PIPELINE] Successfully completed meeting ${meetingId}. Emitting COMPLETED.`);
      
      // Broadcast success to frontend
      io.emit("meeting_ai_status", { 
        meetingId, 
        status: "COMPLETED",
        progress_percentage: 100,
        message: "Pemrosesan selesai!"
      });

      io.emit("meeting_ai_completed", {
        meetingId,
        status: "COMPLETED",
        progress_percentage: 100,
        aiSummary: parsedData,
        analysis_result: parsedData,
        transcript: transcriptText
      });

    } catch (err: any) {
      console.error(`[AI PIPELINE ERROR] Error in AI pipeline for meeting ${meetingId}:`, err);
      if (connection) {
        await connection.query("UPDATE Meetings SET upload_status = 'FAILED' WHERE id = ?", [meetingId]);
      }
      io.emit("meeting_ai_failed", { meetingId, error: err.message || "Gagal memproses AI." });
    } finally {
      if (connection) connection.release();
    }
  }

  // GET: Retrieve meeting status/details (polling fallback)
  router.get("/api/v1/meetings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const connection = await mysqlPool.getConnection();
      const [rows]: any = await connection.query("SELECT * FROM Meetings WHERE id = ?", [id]);
      connection.release();
      if (!rows || rows.length === 0) {
        return res.status(404).json({ status: "error", message: "Meeting tidak ditemukan." });
      }
      return res.json({ status: "success", data: rows[0] });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ status: "error", message: "Gagal mendapatkan status meeting: " + error.message });
    }
  });

  // GET: Dedicated short-polling endpoint for meeting AI processing status
  router.get("/api/v1/meetings/:meetingId/status", async (req, res) => {
    try {
      const { meetingId } = req.params;
      const connection = await mysqlPool.getConnection();
      const [rows]: any = await connection.query("SELECT id, upload_status, transcript, analysis_result, aiSummary FROM Meetings WHERE id = ?", [meetingId]);
      connection.release();
      
      if (!rows || rows.length === 0) {
        return res.status(404).json({ status: "error", message: "Meeting tidak ditemukan." });
      }
      
      const meeting = rows[0];
      let statusValue = meeting.upload_status || "IDLE";
      let progressPercentage = 0;
      let message = "Menunggu pemrosesan...";

      // Standardize the status values for consistencies
      if (statusValue === "PROCESSING_AI") {
        statusValue = "EXTRACTING_AUDIO";
      } else if (statusValue === "TRANSCRIBING") {
        statusValue = "TRANSCRIBING_STT";
      }

      switch (statusValue) {
        case "EXTRACTING_AUDIO":
          progressPercentage = 15;
          message = "Ekstraksi audio sedang berjalan...";
          break;
        case "TRANSCRIBING_STT":
          progressPercentage = 60;
          message = "Mengubah suara rekaman audio menjadi teks mentah secara akurat...";
          break;
        case "ANALYZING_LLM":
          progressPercentage = 90;
          message = "Mengekstrak rangkuman, keputusan, & rencana tindak lanjut dengan AI...";
          break;
        case "COMPLETED":
          progressPercentage = 100;
          message = "Pemrosesan selesai!";
          break;
        case "FAILED":
          progressPercentage = 0;
          message = "Pemrosesan gagal.";
          break;
        case "UPLOAD_SUCCESS":
          progressPercentage = 5;
          message = "Berkas berhasil diunggah. Bersiap memulai pemrosesan...";
          break;
        default:
          progressPercentage = 0;
          message = "Menunggu pemrosesan...";
      }

      return res.json({
        status: statusValue,
        success: true,
        upload_status: statusValue,
        progress_percentage: progressPercentage,
        message: message,
        transcript: meeting.transcript,
        analysis_result: meeting.analysis_result,
        aiSummary: meeting.aiSummary
      });
    } catch (error: any) {
      console.error("GET /api/v1/meetings/:meetingId/status error:", error);
      return res.status(500).json({ status: "error", message: "Gagal mendapatkan status: " + error.message });
    }
  });

  // POST: Cancel or reset AI meeting background job & upload state
  router.post("/api/v1/meetings/:meetingId/cancel", async (req, res) => {
    try {
      const { meetingId } = req.params;
      const connection = await mysqlPool.getConnection();
      
      // Update database back to IDLE and clear file attributes so user can upload again
      await connection.query(
        "UPDATE Meetings SET upload_status = 'IDLE', recording_url = NULL, file_size = NULL, transcript = NULL, aiSummary = NULL, analysis_result = NULL WHERE id = ?",
        [meetingId]
      );
      connection.release();

      // Emit status back to IDLE
      io.emit("meeting_ai_status", { 
        meetingId, 
        status: "IDLE", 
        progress_percentage: 0,
        message: "Pemrosesan dibatalkan."
      });

      return res.json({ status: "success", message: "Pemrosesan rapat berhasil dibatalkan." });
    } catch (error: any) {
      console.error("POST /api/v1/meetings/:meetingId/cancel error:", error);
      return res.status(500).json({ status: "error", message: "Gagal membatalkan pemrosesan: " + error.message });
    }
  });

  // POST: Trigger asynchronous background AI pipeline analysis
  router.post("/api/v1/meetings/:meetingId/analyze", async (req, res) => {
    try {
      const { meetingId } = req.params;

      const connection = await mysqlPool.getConnection();
      const [rows]: any = await connection.query("SELECT * FROM Meetings WHERE id = ?", [meetingId]);
      connection.release();
      
      if (!rows || rows.length === 0) {
        return res.status(404).json({ status: "error", message: "Meeting tidak ditemukan." });
      }

      const meeting = rows[0];
      const recordingUrl = meeting.recording_url;

      if (!recordingUrl) {
        return res.status(400).json({ status: "error", message: "File rekaman belum diunggah." });
      }

      // Trigger the background worker process asynchronously
      runAIPipeline(meetingId).catch(err => console.error("Error in async background worker execution:", err));

      return res.status(202).json({
        status: "success",
        message: "Proses pemrosesan AI (STT & LLM) berhasil dimulai di latar belakang.",
        data: {
          meetingId,
          upload_status: "PROCESSING_AI"
        }
      });

    } catch (error: any) {
      console.error("POST /api/v1/meetings/:meetingId/analyze error:", error);
      return res.status(500).json({ status: "error", message: error.message || "Gagal memulai analisis AI." });
    }
  });

  // POST: Multimodal Video/Audio analysis using Gemini API with exact JSON Schema & saves to meeting_details
  router.post(["/analyze-video", "/api/v1/meetings/:meetingId/analyze-video"], async (req, res) => {
    try {
      const meetingId = req.params.meetingId || req.body.meetingId || req.query.meetingId;
      if (!meetingId) {
        return res.status(400).json({ status: "error", message: "ID Meeting (meetingId) diperlukan." });
      }

      const connection = await mysqlPool.getConnection();
      const [rows]: any = await connection.query("SELECT * FROM Meetings WHERE id = ?", [meetingId]);
      
      if (!rows || rows.length === 0) {
        connection.release();
        return res.status(404).json({ status: "error", message: "Meeting tidak ditemukan." });
      }

      const meeting = rows[0];
      const recordingUrl = meeting.recording_url;

      if (!recordingUrl) {
        connection.release();
        return res.status(400).json({ status: "error", message: "File rekaman belum diunggah." });
      }

      // Set status to ANALYZING_LLM to let client know multimodal processing is ongoing
      await connection.query("UPDATE Meetings SET upload_status = 'ANALYZING_LLM' WHERE id = ?", [meetingId]);
      io.emit("meeting_ai_status", { 
        meetingId, 
        status: "ANALYZING_LLM",
        progress_percentage: 85,
        message: "Menganalisis video & audio multimodal menggunakan Gemini 2.5 Pro..."
      });
      
      const safeFileName = path.basename(recordingUrl);
      
      const filePath = path.join(GLOBAL_UPLOADS_DIR, safeFileName);

      if (!fs.existsSync(filePath)) {
        connection.release();
        return res.status(404).json({ status: "error", message: `File rekaman tidak ditemukan di path: ${filePath}` });
      }

      // Determine mime type
      const fileExt = path.extname(filePath).toLowerCase();
      let mimeType = "video/mp4";
      if (fileExt === ".webm") mimeType = "video/webm";
      else if (fileExt === ".avi") mimeType = "video/x-msvideo";
      else if (fileExt === ".mov") mimeType = "video/quicktime";
      else if (fileExt === ".mkv") mimeType = "video/x-matroska";
      else if (fileExt === ".mp3" || fileExt === ".wav" || fileExt === ".m4a") {
        mimeType = fileExt === ".mp3" ? "audio/mp3" : (fileExt === ".wav" ? "audio/wav" : "audio/x-m4a");
      }

      console.log(`[MULTIMODAL AI] Reading file for multimodal analysis: ${filePath} (${mimeType})`);
      const fileBuffer = fs.readFileSync(filePath);
      const base64File = fileBuffer.toString('base64');

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        connection.release();
        return res.status(400).json({ status: "error", message: "Kunci API Gemini tidak dikonfigurasi." });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // exact responseSchema as requested
      const multimodalSchema = {
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

      // Fetch latest 5-10 learning notes from ai_learning_logs for multimodal analysis
      let learningNotesStr = "";
      try {
        const [logs]: any = await connection.query(
          "SELECT evaluation_notes, timestamp FROM ai_learning_logs WHERE project_id = ? ORDER BY timestamp DESC LIMIT 10",
          [meeting.projectId]
        );
        if (logs && logs.length > 0) {
          learningNotesStr = logs.map((log: any, idx: number) => `[Evaluation #${idx + 1} - ${log.timestamp}]: ${log.evaluation_notes}`).join("\n");
        }
      } catch (logQueryErr) {
        console.warn("[MULTIMODAL AI] Gagal mengambil log evaluasi pembelajaran:", logQueryErr);
      }

      const learningSection = `
PANDUAN PENINGKATAN KEMAMPUAN ADAPTIF (SELF-IMPROVEMENT):
- Di bawah ini adalah daftar kritik dan catatan evaluasi dari user mengenai hasil kerja Anda pada rapat-rapat sebelumnya:
  ${learningNotesStr || "Tidak ada catatan evaluasi sebelumnya. Harap berikan hasil analisis terbaik dan detail secara konsisten."}

- TUGAS ANDA: Analisis kelemahan Anda berdasarkan catatan di atas. Jika user mengkritik Anda 'kurang detail pada aspek arsitektur', maka pada analisis rapat kali ini Anda WAJIB meningkatkan kedalaman informasi pada aspek arsitektur secara drastis.
- Selalu adaptasikan gaya penulisan notulen Anda agar semakin mendekati ekspektasi spesifik yang diminta oleh user dalam log evaluasi tersebut. Jangan ulangi kesalahan klasifikasi atau reduksi informasi yang sama.
`;

      const multimodalPrompt = `Bertindaklah sebagai Senior Full-Stack Architect, Principal AI Engineer, dan Notulis Profesional. Analisis file video/audio rapat ini secara mendalam baik visual (apa yang tampil di slide, screen-share, peragaan) maupun audio (apa yang diucapkan para pembicara).
      
Gunakan responseSchema yang diberikan untuk menghasilkan objek JSON utuh tanpa bungkus markdown. Pastikan semua komponen terisi lengkap berdasarkan informasi riil di dalam video. JANGAN gunakan data dummy atau placeholder kosong. List semua peserta rapat yang terdeteksi di dalam list peserta_rapat di tab_metadata.

${learningSection}`;

      console.log(`[MULTIMODAL AI] Calling Gemini with multimodal prompt on file size: ${fileBuffer.length} bytes`);
      
      const responseGemini = await generateContentWithFallback(ai, {
        model: "gemini-2.5-pro",
        contents: [
          {
            inlineData: {
              data: base64File,
              mimeType: mimeType
            }
          },
          {
            text: multimodalPrompt
          }
        ],
        config: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: multimodalSchema
        }
      });

      const analysisJsonText = responseGemini.text ? responseGemini.text.trim() : "{}";
      let parsedData;
      try {
        parsedData = JSON.parse(analysisJsonText);
      } catch (parseErr) {
        console.error("Failed to parse multimodal analysis JSON:", parseErr);
        parsedData = {};
      }

      // Save to meeting_details table
      const detailId = crypto.randomUUID();
      await connection.query(
        `INSERT INTO meeting_details (
          id, meeting_id, ringkasan_eksekutif, topik_utama, 
          kronologi_dan_kesimpulan, kesimpulan, saran_dan_ide, 
          tindak_lanjut, next_plan, target_to_be_architecture, metadata_rapat
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          detailId,
          meetingId,
          parsedData.tab_ringkasan?.executive_summary_multimodal || "",
          parsedData.tab_ringkasan?.topik_utama || "",
          JSON.stringify(parsedData.tab_kronologi_rapat || []),
          JSON.stringify(parsedData.tab_kesimpulan || []),
          JSON.stringify(parsedData.tab_saran_dan_ide || []),
          JSON.stringify(parsedData.tab_tindak_lanjut || []),
          JSON.stringify(parsedData.tab_next_plan || []),
          JSON.stringify(parsedData.tab_target_to_be || {}),
          JSON.stringify(parsedData.tab_metadata || {})
        ]
      );

      // Synthesize compatible fields for the main Meetings table update
      const ringkasan_eksekutif = parsedData.tab_ringkasan?.executive_summary_multimodal || "";
      const kronologiList = parsedData.tab_kronologi_rapat || [];
      const kesimpulanList = parsedData.tab_kesimpulan || [];
      const saranList = parsedData.tab_saran_dan_ide || [];
      const tindakLanjutList = parsedData.tab_tindak_lanjut || [];
      const nextPlanList = parsedData.tab_next_plan || [];
      const targetToBe = parsedData.tab_target_to_be || {};
      const metadataVal = parsedData.tab_metadata || {};

      const mappedKronologi = kronologiList.map((item: any) => ({
        topik_bahasan: `[${item.timestamp}] Visual: ${item.aktivitas_visual}`,
        latar_belakang_argumen: item.isi_percakapan_inti || "Tidak ada detail argumen.",
        keputusan_akhir: item.isi_percakapan_inti || "Tidak ada keputusan."
      }));

      const mappedTindakLanjut = tindakLanjutList.map((item: any) => ({
        pembicara: "Rapat",
        kekhawatiran_spesifik: item.concern_masalah || "",
        solusi_dan_arahan: item.solusi_disepakati || ""
      }));

      const mappedNextPlan = nextPlanList.map((item: any) => ({
        action_item: item.action_item || "",
        pic: item.pic || "TBD",
        estimasi_waktu: item.due_date || "TBD"
      }));

      const mappedTargetToBe = {
        proses_bisnis_as_is: targetToBe.proses_bisnis_as_is || "",
        proses_bisnis_to_be: targetToBe.proses_bisnis_to_be || "",
        langkah_transisi: targetToBe.langkah_transisi || []
      };

      const mappedMetadata = {
        topik_utama: parsedData.tab_ringkasan?.topik_utama || "Rapat Multimodal",
        tanggal_waktu: metadataVal.tanggal_rapat || new Date().toISOString().split("T")[0],
        peserta_aktif: metadataVal.peserta_rapat || []
      };

      // Construct backward compatible combined JSON to bind to the existing tabs reaktivitas
      const compatibleSummary = {
        ringkasan_eksekutif,
        kronologi_dan_kesimpulan: mappedKronologi,
        tindak_lanjut_dan_concern: mappedTindakLanjut,
        next_plan_roadmap: mappedNextPlan,
        target_to_be_architecture: mappedTargetToBe,
        
        // Exact original JSON schema keys so frontend activeMeetingData can bind them as well
        tab_ringkasan: parsedData.tab_ringkasan,
        tab_kronologi_rapat: parsedData.tab_kronologi_rapat,
        tab_kesimpulan: parsedData.tab_kesimpulan,
        tab_saran_dan_ide: parsedData.tab_saran_dan_ide,
        tab_tindak_lanjut: parsedData.tab_tindak_lanjut,
        tab_next_plan: parsedData.tab_next_plan,
        tab_target_to_be: parsedData.tab_target_to_be,
        tab_metadata: parsedData.tab_metadata,

        // Legacy fallbacks
        notulen_rapat: kronologiList.map((item: any, idx: number) => ({
          topik: `[${item.timestamp}] Visual: ${item.aktivitas_visual}`,
          pembahasan: item.isi_percakapan_inti || ""
        })),
        kesimpulan: kesimpulanList,
        saran: saranList.map((item: any) => `${item.diusulkan_oleh}: ${item.deskripsi_ide}`),
        meeting_metadata: mappedMetadata,
        poin_diskusi_tambahan: tindakLanjutList.map((item: any) => ({
          concern: item.concern_masalah || "",
          tindakanLanjut: item.solusi_disepakati || "",
          PIC: "TBD",
          targetDate: "TBD"
        })),
        next_plan: nextPlanList.map((item: any) => ({
          tahapan: item.action_item || "",
          deskripsi: `PIC: ${item.pic}. Target: ${item.due_date}`,
          estimasi_waktu: item.due_date || "TBD"
        })),
        to_be_scenario: {
          kondisi_sekarang: targetToBe.proses_bisnis_as_is || "",
          target_ke_depan: targetToBe.proses_bisnis_to_be || "",
          langkah_transisi: targetToBe.langkah_transisi || []
        }
      };

      const finalJsonStr = JSON.stringify(compatibleSummary);

      await connection.query(
        "UPDATE Meetings SET aiSummary = ?, analysis_result = ?, upload_status = 'COMPLETED' WHERE id = ?",
        [finalJsonStr, finalJsonStr, meetingId]
      );

      connection.release();

      // Emit real-time completed events
      io.emit("meeting_ai_status", { 
        meetingId, 
        status: "COMPLETED",
        progress_percentage: 100,
        message: "Pemrosesan analisis video multimodal selesai!"
      });

      io.emit("meeting_ai_completed", {
        meetingId,
        status: "COMPLETED",
        progress_percentage: 100,
        aiSummary: compatibleSummary,
        analysis_result: compatibleSummary,
        transcript: meeting.transcript || "Transkrip tidak tersedia. Analisis dilakukan langsung dari rekaman visual video."
      });

      return res.json({
        status: "success",
        message: "Analisis video multimodal berhasil dilakukan dan disimpan.",
        data: {
          detailId,
          meetingId,
          analysis: parsedData
        }
      });

    } catch (error: any) {
      console.error("[MULTIMODAL API ERROR] Error processing video analysis:", error);
      return res.status(500).json({ status: "error", message: "Gagal memproses analisis video multimodal: " + error.message });
    }
  });

  router.post("/api/projects/:projectId/meetings/:id/analyze-transcript", async (req, res) => {
    try {
      const { id } = req.params;
      const { transcript, meetingLink } = req.body;

      if (!transcript || !transcript.trim()) {
        return res.status(400).json({ status: "error", message: "Transkrip tidak boleh kosong." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ status: "error", message: "Kunci API Gemini tidak dikonfigurasi pada server." });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemInstruction = `Bertindaklah sebagai Senior Business Analyst dan PMO Lead kelas enterprise yang sangat detail dan perfeksionis. Tugas Anda adalah menyusun Notulen Rapat Resmi yang sangat komprehensif, mendalam, detail secara UTUH dari Teks Transkrip Mentah (Raw Transcript) hasil rekaman rapat, dan TANPA meringkas/memotong poin penting.

Input yang kamu terima adalah transkrip hasil Speech-to-Text${meetingLink ? ` dan link rapat: ${meetingLink}` : ''}.

Patuhi instruksi ketat berikut:
1. JANGAN lakukan enkapsulasi atau generalisasi (jangan meringkas perdebatan menjadi hanya satu kalimat jika di transkrip mereka berdiskusi panjang).
2. Tuliskan semua studi kasus, nama brand/mitra, angka, estimasi bulan/target, dan istilah teknis secara verbatim (apa adanya sesuai transkrip).
3. Jika ada perdebatan alur berpikir (misal: salah paham di awal lalu dikoreksi oleh pembicara lain), jabarkan kronologi koreksi tersebut di poin diskusi.

Kamu HARUS menghasilkan output dalam format JSON terstruktur yang memiliki kunci-kunci objek berikut:

1. "ringkasan_eksekutif": Susun Notulen Rapat dari transkrip secara UTUH, mendalam, dan TANPA meringkas/memotong poin penting menggunakan struktur formatting Markdown berikut secara ketat:
   ## NOTULEN RAPAT: [Nama Topik/Agenda Rapat Utama]
   **Tanggal:** [Isi Tanggal/Bulan/Tahun jika disebutkan]
   **Topik Utama:** [Tujuan besar rapat ini diadakan]

   ---

   ### **A. DAFTAR HADIR & IDENTIFIKASI PERAN**
   (Daftar semua pembicara beserta peran, divisi, atau latar belakang mereka berdasarkan isi percakapan).

   ---

   ### **B. KRONOLOGI DISKUSI MENDALAM & DETAIL TEKNIS**
   (Kupas habis setiap topik yang didebatkan. Bagi menjadi sub-heading (###) berdasarkan topik masalah. Masukkan detail arsitektur sistem, skema database/API/flow data, alasan bisnis di balik sebuah request, serta perbandingan sistem eksisting vs sistem baru yang dibahas).

   ---

   ### **C. BREAKDOWN RENCANA TINDAK LANJUT (ACTION ITEMS)**
   (Buat daftar tugas konkret yang sifatnya operasional dan siap dieksekusi, sebutkan:
   - Pihak/Tim Penanggung Jawab.
   - Detail Tugas (Langkah 1, Langkah 2, dst).
   - Dampak Teknis/Bisnis jika tugas ini dijalankan).

2. "notulen_rapat": Berisi kronologi jalannya rapat terstruktur (Notulet Rapat). Kelompokkan berdasarkan topik bahasan utama yang dibicarakan oleh para peserta beserta alur argumennya secara riil tanpa rekayasa.
3. "kesimpulan": Poin-poin mutlak mengenai keputusan apa saja yang sudah disepakati di akhir rapat. Jangan memasukkan perdebatan di sini, hanya hasil akhir.
4. "saran": Rekomendasi, ide, atau masukan yang dilontarkan oleh peserta rapat sebagai bahan pertimbangan ke depan (meskipun belum sah menjadi keputusan).
5. "meeting_metadata": Deteksi otomatis topik utama rapat, perkiraan tanggal/waktu (jika disebutkan), dan daftar nama peserta yang terdeteksi aktif berbicara.
6. "poin_diskusi_tambahan": Ekstrak butir-butir diskusi penting yang membutuhkan tindak lanjut (action items), lengkap dengan PIC (Person in Charge) dan tenggat waktu (due date) jika disebutkan di dalam teks.
7. "next_plan": Menyusun rencana tindak lanjut berikutnya (Next Plan) yang berisikan tahapan-tahapan aksi nyata secara terperinci, berdasarkan keputusan di rapat.
8. "to_be_scenario": Gambaran skenario target di masa depan (To-Be Scenario), mendetailkan perbandingan kondisi sistem/proses saat ini (As-Is) dan bagaimana seharusnya sistem/proses tersebut berjalan ke depan (To-Be), termasuk langkah-langkah transisi yang realistis berdasarkan isi rapat.

ATURAN KETAT (ANTI-HALUSINASI):
- Kamu harus menganalisis transkrip secara RIIL. Jangan mengarang fitur, sistem, nama orang, tanggal, atau rencana yang sama sekali tidak disebutkan atau tidak disirat secara logis dari isi transkrip rapat.
- Gunakan Bahasa Indonesia yang formal, profesional, mudah dipahami, dan ringkas namun padat informasi.
- Berikan output HANYA dalam format JSON valid sesuai skema yang diminta.`;

      const response = await generateContentWithFallback(ai, {
        model: "gemini-flash-latest",
        contents: `[TRANSKRIP SELESAI]:\n${transcript}${meetingLink ? `\n[LINK RAPAT]: ${meetingLink}` : ''}`,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ringkasan_eksekutif: {
                type: Type.STRING,
                description: "Notulen Rapat dari transkrip secara UTUH, mendalam, dan TANPA meringkas/memotong poin penting menggunakan struktur formatting Markdown berikut secara ketat:\n\n## NOTULEN RAPAT: [Nama Topik/Agenda Rapat Utama]\n**Tanggal:** [Isi Tanggal/Bulan/Tahun jika disebutkan]\n**Topik Utama:** [Tujuan besar rapat ini diadakan]\n\n---\n\n### **A. DAFTAR HADIR & IDENTIFIKASI PERAN**\n(Daftar semua pembicara beserta peran, divisi, atau latar belakang mereka berdasarkan isi percakapan).\n\n---\n\n### **B. KRONOLOGI DISKUSI MENDALAM & DETAIL TEKNIS**\n(Kupas habis setiap topik yang didebatkan. Bagi menjadi sub-heading (###) berdasarkan topik masalah. Masukkan detail arsitektur sistem, skema database/API/flow data, alasan bisnis di balik sebuah request, serta perbandingan sistem eksisting vs sistem baru yang dibahas).\n\n---\n\n### **C. BREAKDOWN RENCANA TINDAK LANJUT (ACTION ITEMS)**\n(Buat daftar tugas konkret yang sifatnya operasional dan siap dieksekusi, sebutkan:\n- Pihak/Tim Penanggung Jawab.\n- Detail Tugas (Langkah 1, Langkah 2, dst).\n- Dampak Teknis/Bisnis jika tugas ini dijalankan)."
              },
              notulen_rapat: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topik: { type: Type.STRING, description: "Topik bahasan utama yang dibicarakan peserta rapat." },
                    pembahasan: { type: Type.STRING, description: "Alur argumen dan jalannya rapat mengenai topik ini (dalam Bahasa Indonesia)." }
                  },
                  required: ["topik", "pembahasan"]
                },
                description: "Kronologi jalannya rapat terstruktur dikelompokkan berdasarkan topik bahasan utama."
              },
              kesimpulan: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Poin-poin keputusan akhir yang disepakati (Bahasa Indonesia)."
              },
              saran: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Rekomendasi, ide, atau masukan dari peserta rapat (Bahasa Indonesia)."
              },
              meeting_metadata: {
                type: Type.OBJECT,
                properties: {
                  topik_utama: { type: Type.STRING, description: "Deteksi otomatis topik utama rapat." },
                  tanggal_waktu: { type: Type.STRING, description: "Perkiraan tanggal/waktu jika disebutkan, kosongkan jika tidak." },
                  peserta_aktif: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Daftar nama peserta yang aktif berbicara."
                  }
                },
                required: ["topik_utama", "peserta_aktif"]
              },
              poin_diskusi_tambahan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    concern: { type: Type.STRING, description: "Isu / poin diskusi penting pemicu tindak lanjut." },
                    fitur: { type: Type.STRING, description: "Nama fitur terkait (kosongkan jika tidak ada)." },
                    system: { type: Type.STRING, description: "Sistem / subsistem terkait (kosongkan jika tidak ada)." },
                    surrounding: { type: Type.STRING, description: "Konteks/pihak lain sekeliling yang terdampak." },
                    keterangan: { type: Type.STRING, description: "Penjelasan/deskripsi singkat." },
                    tindakanLanjut: { type: Type.STRING, description: "Rencana tindak lanjut / action item konkret." },
                    PIC: { type: Type.STRING, description: "Nama Person In Charge jika ada." },
                    targetDate: { type: Type.STRING, description: "Tenggat waktu pengerjaan (format YYYY-MM-DD jika ada, atau teks singkat)." }
                  },
                  required: ["concern", "tindakanLanjut"]
                },
                description: "Daftar poin diskusi tambahan / action items."
              },
              next_plan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    tahapan: { type: Type.STRING, description: "Nama tahapan atau fase rencana aksi selanjutnya." },
                    deskripsi: { type: Type.STRING, description: "Penjelasan detail mengenai rencana aksi tersebut berdasarkan transkrip." },
                    estimasi_waktu: { type: Type.STRING, description: "Estimasi waktu pelaksanaan jika dibahas, jika tidak kosongi." }
                  },
                  required: ["tahapan", "deskripsi"]
                },
                description: "Rencana jangka pendek dan menengah (Next Plan) riil hasil pembahasan rapat."
              },
              to_be_scenario: {
                type: Type.OBJECT,
                properties: {
                  kondisi_sekarang: { type: Type.STRING, description: "Kondisi sistem/proses saat ini (As-Is) yang dibahas atau dikeluhkan." },
                  target_ke_depan: { type: Type.STRING, description: "Gambaran detail sistem/proses ke depan (To-Be) yang disepakati atau diusulkan." },
                  langkah_transisi: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Langkah transisi atau proses migrasi menuju kondisi To-Be."
                  }
                },
                required: ["kondisi_sekarang", "target_ke_depan", "langkah_transisi"],
                description: "Analisis kondisi sistem/proses masa depan (To-Be Scenario) riil hasil rapat."
              }
            },
            required: ["ringkasan_eksekutif", "notulen_rapat", "kesimpulan", "saran", "meeting_metadata", "poin_diskusi_tambahan", "next_plan", "to_be_scenario"]
          }
        }
      });

      const jsonStr = response.text ? response.text.trim() : "{}";
      let parsedData;
      try {
        parsedData = JSON.parse(jsonStr);
      } catch (parseErr) {
        console.error("Failed to parse transcript analysis JSON:", parseErr);
        parsedData = {};
      }

      // Simpan langsung ke kolom Meetings jika inginkan persistence
      const connection = await mysqlPool.getConnection();
      await connection.query(
        "UPDATE Meetings SET transcript = ?, aiSummary = ? WHERE id = ?",
        [transcript, jsonStr, id]
      );
      connection.release();

      res.json({
        status: "success",
        data: parsedData
      });
    } catch (error: any) {
      console.error("POST /api/projects/:projectId/meetings/:id/analyze-transcript error:", error);
      res.status(500).json({ status: "error", message: error.message || "Gagal menganalisis transkrip." });
    }
  });

  // ==========================================
  // NOTEBOOKLM INTEGRATION API ENDPOINTS
  // ==========================================
  router.post("/api/notebooklm/chat", authenticateJWT, async (req: any, res: any) => {
    try {
      const { sources, prompt, history, model } = req.body;
      if (!prompt || !prompt.trim()) {
        return res.status(400).json({ status: "error", message: "Prompt tidak boleh kosong." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ status: "error", message: "Kunci API Gemini tidak dikonfigurasi pada server." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      // Prepare grounded source context
      let contextText = "";
      if (Array.isArray(sources) && sources.length > 0) {
        contextText = sources.map((s: any, idx: number) => {
          return `--- SUMBER [${idx + 1}]: ${s.title || 'Dokumen'} (${s.type || 'Text'}) ---\n${s.content || ''}\n`;
        }).join("\n");
      } else {
        contextText = "Tidak ada sumber data terpasang. Jawab berdasarkan pengetahuan umum tetapi beri tahu pengguna bahwa mereka dapat mengunggah atau mencentang sumber data di NotebookLM.";
      }

      const systemInstruction = `Anda adalah Asisten Peneliti AI NotebookLM yang cerdas, obyektif, dan presisi.
Tugas Anda adalah memberikan jawaban berbasis eksklusif pada Sumber Data (Sources) yang disediakan pengguna berikut ini:

${contextText}

ATURAN UTAMA:
1. Setiap kali Anda menggunakan fakta, kutipan, atau data dari sumber di atas, SERTAKAN KUTIPAN LANGSUNG dengan format [Sumber N: Judul]. Contoh: "Berdasarkan [Sumber 1: Notulen Rapat Project BNI], target rilis adalah bulan depan."
2. Jika pertanyaan pengguna tidak dapat dijawab dari Sumber Data yang aktif, nyatakan dengan jujur dan sopan: "Informasi mengenai hal tersebut tidak ditemukan dalam sumber data yang aktif."
3. Jawab dalam Bahasa Indonesia yang lugas, profesional, dan terstruktur rapi menggunakan format Markdown.`;

      const contents = [];
      if (Array.isArray(history) && history.length > 0) {
        for (const msg of history.slice(-6)) {
          contents.push(`${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}`);
        }
      }
      contents.push(`User: ${prompt}`);

      const chosenModel = model || "gemini-2.5-pro";

      const response = await generateContentWithFallback(ai, {
        model: chosenModel,
        contents: contents.join("\n\n"),
        config: {
          systemInstruction,
          temperature: 0.3,
        }
      });

      return res.json({
        status: "success",
        reply: response.text || "Tidak ada respon dari AI."
      });
    } catch (err: any) {
      console.error("[NOTEBOOKLM_CHAT_ERROR]", err);
      return res.status(500).json({ status: "error", message: err.message || "Gagal memproses pertanyaan NotebookLM" });
    }
  });

  router.post("/api/notebooklm/generate-overview", authenticateJWT, async (req: any, res: any) => {
    try {
      const { sources, type = 'summary' } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ status: "error", message: "Kunci API Gemini tidak dikonfigurasi pada server." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      let contextText = "";
      if (Array.isArray(sources) && sources.length > 0) {
        contextText = sources.map((s: any, idx: number) => {
          return `--- SUMBER [${idx + 1}]: ${s.title || 'Dokumen'} ---\n${s.content || ''}\n`;
        }).join("\n");
      } else {
        return res.status(400).json({ status: "error", message: "Pilih minimal 1 sumber data untuk membuat overview." });
      }

      let promptInstruction = "";
      if (type === 'summary') {
        promptInstruction = `Buat Ringkasan Eksekutif Komprehensif dari semua sumber data di atas. Gunakan poin-poin utama, ide kunci, serta implikasi praktis.`;
      } else if (type === 'qa') {
        promptInstruction = `Buat daftar 5-8 Tanya Jawab (FAQ / Q&A) paling relevan dan penting dari sumber data di atas. Setiap pertanyaan harus memiliki jawaban ringkas dan tepat sasaran.`;
      } else if (type === 'podcast') {
        promptInstruction = `Buat Naskah Audio Podcast Diskusi (Audio Overview / 2 Host NotebookLM style) antara 'Host A (Alex)' dan 'Host B (Bima)'.
Alex berperan sebagai pembawa acara yang antusias dan mengajukan pertanyaan mendalam, sementara Bima adalah pakar riset yang menjelaskan detail teknis & temuan kunci dari sumber data.
Buat dialog yang alami, informatif, dan menarik sebanyak 6-10 giliran bicara.`;
      } else if (type === 'study_guide') {
        promptInstruction = `Buat Panduan Belajar / Study Guide terstruktur dari sumber data di atas, mencakup:
1. Istilah Kunci & Definisi
2. Pertanyaan Pemahaman
3. Topik Diskusi Lanjutan`;
      } else if (type === 'briefing') {
        promptInstruction = `Buat Dokumen Briefing Eksekutif (Briefing Doc) siap pakai untuk pimpinan, mencakup Tujuan, Temuan Utama, Risiko/Tantangan, dan Rekomendasi Aksi.`;
      }

      const response = await generateContentWithFallback(ai, {
        model: "gemini-3.6-flash",
        contents: `SUMBER DATA:\n${contextText}\n\nINSTRUKSI KHUSUS:\n${promptInstruction}`,
        config: {
          systemInstruction: "Anda adalah pakar riset dan perangkum dokumen tingkat dunia. Buatlah output dalam Bahasa Indonesia yang rapi dan terstruktur dalam format Markdown.",
          temperature: 0.4
        }
      });

      return res.json({
        status: "success",
        type,
        content: response.text || "Gagal menghasilkan overview."
      });
    } catch (err: any) {
      console.error("[NOTEBOOKLM_OVERVIEW_ERROR]", err);
      return res.status(500).json({ status: "error", message: err.message || "Gagal membuat overview NotebookLM" });
    }
  });

  router.post("/api/notebooklm/generate-audio", authenticateJWT, async (req: any, res: any) => {
    try {
      const { text, voiceName = 'Kore' } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ status: "error", message: "Teks audio tidak boleh kosong." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ status: "error", message: "Kunci API Gemini tidak dikonfigurasi pada server." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const cleanText = text.replace(/[*#_\-\`]/g, '').slice(0, 1000);

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: `Bacakan teks berikut dengan jelas, artikulasi ramah dan profesional: ${cleanText}` }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' }
            }
          }
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        return res.status(500).json({ status: "error", message: "Gagal menghasilkan data audio dari Gemini TTS." });
      }

      return res.json({
        status: "success",
        audioBase64: base64Audio,
        mimeType: "audio/pcm"
      });
    } catch (err: any) {
      console.error("[NOTEBOOKLM_AUDIO_ERROR]", err);
      return res.status(500).json({ status: "error", message: err.message || "Gagal menghasilkan audio TTS" });
    }
  });

  // ProjectModules API (Master Data for Modul/Aplikasi)
  router.get("/api/project-modules", async (req, res) => {
    let connection;
    try {
      connection = await mysqlPool.getConnection();
      const [rows] = await connection.query("SELECT * FROM ProjectModules ORDER BY createdAt DESC");
      res.json({ status: "success", data: rows });
    } catch (error: any) {
      console.error("GET /api/project-modules error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  router.post("/api/project-modules", async (req, res) => {
    let connection;
    try {
      const { id, projectId, namaModul, keterangan } = req.body;
      if (!projectId || !namaModul) {
        return res.status(400).json({ status: "error", message: "projectId and namaModul are required" });
      }
      connection = await mysqlPool.getConnection();
      await connection.query(
        "INSERT INTO ProjectModules (id, projectId, namaModul, keterangan, createdAt) VALUES (?, ?, ?, ?, ?)",
        [id || String(Date.now()), projectId, namaModul, keterangan || null, new Date().toISOString()]
      );
      res.json({ status: "success", message: "Module created" });
    } catch (error: any) {
      console.error("POST /api/project-modules error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  router.put("/api/project-modules/:id", async (req, res) => {
    let connection;
    try {
      const { id } = req.params;
      const { projectId, namaModul, keterangan } = req.body;
      connection = await mysqlPool.getConnection();
      await connection.query(
        "UPDATE ProjectModules SET projectId = ?, namaModul = ?, keterangan = ? WHERE id = ?",
        [projectId, namaModul, keterangan || null, id]
      );
      res.json({ status: "success", message: "Module updated" });
    } catch (error: any) {
      console.error("PUT /api/project-modules/:id error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  router.delete("/api/project-modules/:id", async (req, res) => {
    let connection;
    try {
      const { id } = req.params;
      connection = await mysqlPool.getConnection();
      await connection.beginTransaction();
      
      // Delete test cases linked to this module
      await connection.query("DELETE FROM QATestCases WHERE modulId = ?", [id]);
      
      // Delete module
      await connection.query("DELETE FROM ProjectModules WHERE id = ?", [id]);
      
      await connection.commit();
      res.json({ status: "success", message: "Module and linked test cases deleted" });
    } catch (error: any) {
      if (connection) await connection.rollback();
      console.error("DELETE /api/project-modules/:id error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  // Tasks API
  router.use(taskRoutes);

  router.get("/api/projects/:projectId/documents", verifyProjectAccess(['*']), async (req, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      connection = await mysqlPool.getConnection();
      const [rows] = await connection.query("SELECT id, projectId, title, description, type, link, fileName, fileType, createdBy, downloadCount, createdAt, updatedAt FROM Documents WHERE projectId = ? ORDER BY createdAt DESC", [projectId]);
      res.json({ status: "success", data: rows });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  router.get("/api/projects/:projectId/documents/:id/download", verifyProjectAccess(['*']), async (req, res) => {
    let connection;
    try {
      const { id } = req.params;
      connection = await mysqlPool.getConnection();
      const [rows] = await connection.query("SELECT fileData, fileName, fileType FROM Documents WHERE id = ?", [id]);
      console.log(`[DOWNLOAD DOC] id: ${id}, rows length: ${(rows as any[]).length}`);
      await connection.query("UPDATE Documents SET downloadCount = downloadCount + 1 WHERE id = ?", [id]);
      if ((rows as any[]).length > 0) {
         res.json({ status: "success", data: (rows as any[])[0] });
      } else {
         const { getDbMode } = await import("./src/lib/db"); res.status(404).json({ status: "error", message: "Document not found. id: " + id + ", mode: " + getDbMode() });
      }
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  router.post("/api/projects/:projectId/documents", verifyProjectAccess(['*']), async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const { title, description, type, link, fileData, fileName, fileType, createdBy } = req.body;
      const currentUserId = req.user?.id || req.user?.uid || createdBy || "guest";
      const connection = await mysqlPool.getConnection();
      const newId = crypto.randomUUID();
      await connection.query(
        "INSERT INTO Documents (id, projectId, title, description, type, link, fileData, fileName, fileType, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [newId, projectId, title, description || null, type || null, link || null, fileData || null, fileName || null, fileType || null, currentUserId]
      );
      connection.release();
      res.json({ status: "success", data: { id: newId, projectId, title, description, type, link, fileName, fileType, createdBy: currentUserId } });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  });

  router.put("/api/projects/:projectId/documents/:id", verifyProjectAccess(['*']), async (req: any, res) => {
    let connection;
    try {
      const { id } = req.params;
      connection = await mysqlPool.getConnection();

      const [rows]: any = await connection.query("SELECT * FROM Documents WHERE id = ?", [id]);
      if (!rows || rows.length === 0) {
        connection.release();
        return res.status(404).json({ status: "error", message: "Document not found" });
      }
      const item = rows[0];

      const currentUserId = req.user?.id || req.user?.uid || req.headers["x-user-id"];
      const userRole = (req.user?.role || req.user?.system_role || '').toUpperCase();
      const isAdmin = ['SADM', 'ADMN', 'ADMIN'].includes(userRole);
      const authorId = item.createdBy || item.author_id || item.authorId;
      const isAuthor = authorId === currentUserId;

      if (!isAuthor && !isAdmin) {
        connection.release();
        return res.status(403).json({
          status: "error",
          error: "Akses ditolak: Anda hanya diizinkan untuk melihat data ini."
        });
      }

      const { title, description, type, link, fileData, fileName, fileType } = req.body;
      
      const updates = [];
      const values = [];
      if (title !== undefined) { updates.push("title = ?"); values.push(title); }
      if (description !== undefined) { updates.push("description = ?"); values.push(description); }
      if (type !== undefined) { updates.push("type = ?"); values.push(type); }
      if (link !== undefined) { updates.push("link = ?"); values.push(link); }
      if (fileData !== undefined) { updates.push("fileData = ?"); values.push(fileData); }
      if (fileName !== undefined) { updates.push("fileName = ?"); values.push(fileName); }
      if (fileType !== undefined) { updates.push("fileType = ?"); values.push(fileType); }
      
      if (updates.length > 0) {
        values.push(id);
        await connection.query(`UPDATE Documents SET ${updates.join(', ')} WHERE id = ?`, values);
      }
      connection.release();
      res.json({ status: "success", message: "Document updated" });
    } catch (error: any) {
      if (connection) connection.release();
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  });

  router.delete("/api/projects/:projectId/documents/:id", verifyProjectAccess(['*']), async (req: any, res) => {
    let connection;
    try {
      const { id } = req.params;
      connection = await mysqlPool.getConnection();

      const [rows]: any = await connection.query("SELECT * FROM Documents WHERE id = ?", [id]);
      if (!rows || rows.length === 0) {
        connection.release();
        return res.status(404).json({ status: "error", message: "Document not found" });
      }
      const item = rows[0];

      const currentUserId = req.user?.id || req.user?.uid || req.headers["x-user-id"];
      const userRole = (req.user?.role || req.user?.system_role || '').toUpperCase();
      const isAdmin = ['SADM', 'ADMN', 'ADMIN'].includes(userRole);
      const authorId = item.createdBy || item.author_id || item.authorId;
      const isAuthor = authorId === currentUserId;

      if (!isAuthor && !isAdmin) {
        connection.release();
        return res.status(403).json({
          status: "error",
          error: "Akses ditolak: Anda hanya diizinkan untuk melihat data ini."
        });
      }

      await connection.query("DELETE FROM Documents WHERE id = ?", [id]);
      connection.release();
      res.json({ status: "success", message: "Document deleted" });
    } catch (error: any) {
      if (connection) connection.release();
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  });
  // Milestones API (Hybrid Value-Added)
  router.get("/api/projects/:projectId/milestones", verifyProjectAccess(['*']), async (req, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      connection = await mysqlPool.getConnection();
      
      const [milestones]: any = await connection.query(
        "SELECT * FROM Milestones WHERE projectId = ? ORDER BY dueDate ASC",
        [projectId]
      );

      // Optimization: Get ALL milestone-sprint links in ONE query
      const [allMilestoneLinks]: any = await connection.query(
        "SELECT milestoneId, sprintId FROM MilestoneSprints WHERE milestoneId IN (SELECT id FROM Milestones WHERE projectId = ?)",
        [projectId]
      );

      // Map milestoneId -> sprintIds
      const milestoneSprintMap = new Map<string, string[]>();
      for (const link of allMilestoneLinks) {
        if (!milestoneSprintMap.has(link.milestoneId)) {
          milestoneSprintMap.set(link.milestoneId, []);
        }
        milestoneSprintMap.get(link.milestoneId)!.push(link.sprintId);
      }

      // Get stats for ALL sprints in ONE query
      const allSprintIds = new Set<string>();
      milestoneSprintMap.forEach(sprints => sprints.forEach(s => allSprintIds.add(s)));

      let sprintStatsMap = new Map<string, any>();
      if (allSprintIds.size > 0) {
        const [stats]: any = await connection.query(`
          SELECT
            sprintId,
            SUM(CASE WHEN status = 'Done' THEN storyPoints ELSE 0 END) as donePoints,
            SUM(storyPoints) as totalPoints
          FROM Tasks
          WHERE sprintId IN (?) AND storyPoints IS NOT NULL
          GROUP BY sprintId
        `, [Array.from(allSprintIds)]);

        stats.forEach((stat: any) => {
          sprintStatsMap.set(stat.sprintId, stat);
        });
      }

      // Calculate progress for each milestone using pre-fetched data
      for (const ms of milestones) {
        const sprintIds = milestoneSprintMap.get(ms.id) || [];
        if (sprintIds.length > 0) {
          let totalPoints = 0, donePoints = 0;
          sprintIds.forEach(sprintId => {
            const stat = sprintStatsMap.get(sprintId);
            if (stat) {
              totalPoints += stat.totalPoints || 0;
              donePoints += stat.donePoints || 0;
            }
          });
          ms.progress = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;
          ms.totalStoryPoints = totalPoints;
          ms.doneStoryPoints = donePoints;
        } else {
          ms.progress = 0;
        }
      }

      res.json({ status: "success", data: milestones });
    } catch (error: any) {
      console.error("LOG ANOMALI CRITICAL: GET milestones error:", error);
      res.status(500).json({ status: "error", message: "Gagal mengambil Milestone." });
    } finally {
      if (connection) connection.release();
    }
  });

  router.post("/api/projects/:projectId/milestones", verifyProjectAccess(['admin', 'manager', 'head']), async (req, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      const { name, description, dueDate, sprintIds } = req.body;
      const userId = req.headers['x-user-id'] || req.query.userId || 'guest';
      
      connection = await mysqlPool.getConnection();
      const milestoneId = crypto.randomUUID();

      await connection.query(
        "INSERT INTO Milestones (id, projectId, name, description, dueDate, status) VALUES (?, ?, ?, ?, ?, ?)",
        [milestoneId, projectId, name, description || '', dueDate || null, 'planned']
      );

      if (sprintIds && Array.isArray(sprintIds)) {
        for (const sid of sprintIds) {
          await connection.query("INSERT INTO MilestoneSprints (milestoneId, sprintId) VALUES (?, ?)", [milestoneId, sid]);
        }
      }

      await createAuditLog(userId as string, projectId, 'CREATE', 'Milestones', milestoneId, null, { name, sprintIds });

      res.json({ status: "success", data: { id: milestoneId, name, milestoneId } });
    } catch (error: any) {
      console.error("LOG ANOMALI CRITICAL: POST milestones error:", error);
      res.status(500).json({ status: "error", message: "Gagal membuat Milestone." });
    } finally {
      if (connection) connection.release();
    }
  });

  router.put("/api/projects/:projectId/milestones/:id", verifyProjectAccess(['admin', 'manager', 'head']), async (req, res) => {
    let connection;
    try {
      const { id, projectId } = req.params;
      const { name, description, dueDate, status, sprintIds } = req.body;
      const userId = req.headers['x-user-id'] || 'guest';
      
      connection = await mysqlPool.getConnection();
      
      const updates = [];
      const values = [];
      if (name !== undefined) { updates.push("name = ?"); values.push(name); }
      if (description !== undefined) { updates.push("description = ?"); values.push(description); }
      if (dueDate !== undefined) { updates.push("dueDate = ?"); values.push(dueDate); }
      if (status !== undefined) { updates.push("status = ?"); values.push(status); }

      if (updates.length > 0) {
        values.push(id);
        await connection.query(`UPDATE Milestones SET ${updates.join(', ')} WHERE id = ?`, values);
      }

      if (sprintIds !== undefined && Array.isArray(sprintIds)) {
        await connection.query("DELETE FROM MilestoneSprints WHERE milestoneId = ?", [id]);
        for (const sid of sprintIds) {
          await connection.query("INSERT INTO MilestoneSprints (milestoneId, sprintId) VALUES (?, ?)", [id, sid]);
        }
      }

      await createAuditLog(userId as string, projectId, 'UPDATE', 'Milestones', id, null, req.body);
      res.json({ status: "success", message: "Milestone updated" });
    } catch (error: any) {
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  router.delete("/api/projects/:projectId/milestones/:id", verifyProjectAccess(['admin', 'head']), async (req, res) => {
    let connection;
    try {
      const { id, projectId } = req.params;
      const userId = req.headers['x-user-id'] || 'guest';
      connection = await mysqlPool.getConnection();
      
      await createAuditLog(userId as string, projectId, 'DELETE', 'Milestones', id, null, null);
      await connection.query("DELETE FROM Milestones WHERE id = ?", [id]);
      
      res.json({ status: "success", message: "Milestone deleted" });
    } catch (error: any) {
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  // Meetings API
  router.get("/api/projects/:projectId/meetings", verifyProjectAccess(['*']), async (req, res) => {
    try {
      const { projectId } = req.params;
      const connection = await mysqlPool.getConnection();
      const [rows] = await connection.query(
        "SELECT id, projectId, title, description, meetingLink, authorId, createdAt, updatedAt, fileName, fileType, file_size FROM Meetings WHERE projectId = ? ORDER BY createdAt DESC",
        [projectId]
      );
      connection.release();
      res.json({ status: "success", data: rows });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  });

  router.post("/api/projects/:projectId/meetings", verifyProjectAccess(['*']), async (req, res) => {
    try {
      const { projectId } = req.params;
      const { title, description, meetingLink, authorId, fileData, fileName, fileType } = req.body;
      const effectiveAuthorId = authorId || req.headers["x-user-id"] || "guest";
      const connection = await mysqlPool.getConnection();
      const newId = crypto.randomUUID();
      await connection.query(
        "INSERT INTO Meetings (id, projectId, title, description, meetingLink, authorId, fileData, fileName, fileType) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [newId, projectId, title, description || null, meetingLink || null, effectiveAuthorId, fileData || null, fileName || null, fileType || null]
      );
      connection.release();
      res.json({ status: "success", data: { id: newId, projectId, title, description, meetingLink, authorId: effectiveAuthorId, fileName, fileType } });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  });

  router.put("/api/projects/:projectId/meetings/:id", verifyProjectAccess(['*']), async (req: any, res) => {
    let connection;
    try {
      const { id } = req.params;
      connection = await mysqlPool.getConnection();

      const [rows]: any = await connection.query("SELECT * FROM Meetings WHERE id = ?", [id]);
      if (!rows || rows.length === 0) {
        connection.release();
        return res.status(404).json({ status: "error", message: "Meeting not found" });
      }
      const item = rows[0];

      const currentUserId = req.user?.id || req.user?.uid || req.headers["x-user-id"];
      const userRole = (req.user?.role || req.user?.system_role || '').toUpperCase();
      const isAdmin = ['SADM', 'ADMN', 'ADMIN'].includes(userRole);
      const authorId = item.authorId || item.author_id;
      const isAuthor = authorId === currentUserId;

      if (!isAuthor && !isAdmin) {
        connection.release();
        return res.status(403).json({
          status: "error",
          error: "Akses ditolak: Anda hanya diizinkan untuk melihat data ini."
        });
      }

      const { title, description, meetingLink, transcript, aiSummary, fileData, fileName, fileType } = req.body;
      const updates = [];
      const values = [];
      if (title !== undefined) { updates.push('title = ?'); values.push(title); }
      if (description !== undefined) { updates.push('description = ?'); values.push(description); }
      if (meetingLink !== undefined) { updates.push('meetingLink = ?'); values.push(meetingLink); }
      if (transcript !== undefined) { updates.push('transcript = ?'); values.push(transcript); }
      if (fileData !== undefined) { updates.push('fileData = ?'); values.push(fileData); }
      if (fileName !== undefined) { updates.push('fileName = ?'); values.push(fileName); }
      if (fileType !== undefined) { updates.push('fileType = ?'); values.push(fileType); }
      if (aiSummary !== undefined) {
        updates.push('aiSummary = ?');
        values.push(aiSummary ? (typeof aiSummary === 'string' ? aiSummary : JSON.stringify(aiSummary)) : null);
      }
      
      if (updates.length > 0) {
        values.push(id);
        await connection.query(`UPDATE Meetings SET ${updates.join(', ')} WHERE id = ?`, values);
      }
      connection.release();
      res.json({ status: "success", message: "Meeting updated" });
    } catch (error: any) {
      if (connection) connection.release();
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  });

  router.get("/api/projects/:projectId/meetings/:id/download", verifyProjectAccess(['*']), async (req, res) => {
    let connection;
    try {
      const { id } = req.params;
      connection = await mysqlPool.getConnection();
      const [rows] = await connection.query("SELECT fileData, fileName, fileType FROM Meetings WHERE id = ?", [id]);
      if ((rows as any[]).length > 0) {
         res.json({ status: "success", data: (rows as any[])[0] });
      } else {
         res.status(404).json({ status: "error", message: "Meeting atau berkas tidak ditemukan" });
      }
    } catch (error: any) {
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  router.delete("/api/projects/:projectId/meetings/:id", verifyProjectAccess(['*']), async (req: any, res) => {
    let connection;
    try {
      const { id } = req.params;
      connection = await mysqlPool.getConnection();

      const [rows]: any = await connection.query("SELECT * FROM Meetings WHERE id = ?", [id]);
      if (!rows || rows.length === 0) {
        connection.release();
        return res.status(404).json({ status: "error", message: "Meeting not found" });
      }
      const item = rows[0];

      const currentUserId = req.user?.id || req.user?.uid || req.headers["x-user-id"];
      const userRole = (req.user?.role || req.user?.system_role || '').toUpperCase();
      const isAdmin = ['SADM', 'ADMN', 'ADMIN'].includes(userRole);
      const authorId = item.authorId || item.author_id;
      const isAuthor = authorId === currentUserId;

      if (!isAuthor && !isAdmin) {
        connection.release();
        return res.status(403).json({
          status: "error",
          error: "Akses ditolak: Anda hanya diizinkan untuk melihat data ini."
        });
      }

      await connection.query("DELETE FROM Meetings WHERE id = ?", [id]);
      connection.release();
      res.json({ status: "success", message: "Meeting deleted" });
    } catch (error: any) {
      if (connection) connection.release();
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  });

  // Discussion Points API
  router.get("/api/projects/:projectId/meetings/:id/discussionPoints", verifyProjectAccess(['*']), async (req, res) => {
    try {
      const { id } = req.params;
      const connection = await mysqlPool.getConnection();
      const [rows] = await connection.query("SELECT * FROM DiscussionPoints WHERE meetingId = ? ORDER BY createdAt ASC", [id]);
      connection.release();
      res.json({ status: "success", data: rows });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  });

  router.post("/api/projects/:projectId/meetings/:id/discussionPoints", verifyProjectAccess(['*']), async (req, res) => {
    try {
      const { id } = req.params;
      const { parentPointId, authorId, assignTo, concern, fitur, system, surrounding, keterangan, tindakanLanjut, status, targetDate, tanggalUpdateStatus } = req.body;
      const effectiveAuthorId = authorId || req.headers["x-user-id"] || "guest";
      const connection = await mysqlPool.getConnection();
      const newId = crypto.randomUUID();
      const contentVal = concern || keterangan || "Poin Diskusi";
      try {
        await connection.query(
          "INSERT INTO DiscussionPoints (id, meetingId, \"parentPointId\", \"authorId\", \"assignTo\", concern, fitur, \"system\", surrounding, keterangan, \"tindakanLanjut\", status, \"targetDate\", \"tanggalUpdateStatus\", content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            newId,
            id,
            parentPointId || null,
            effectiveAuthorId,
            assignTo || null,
            concern || null,
            fitur || null,
            system || null,
            surrounding || null,
            keterangan || null,
            tindakanLanjut || null,
            status || 'pending',
            targetDate || null,
            tanggalUpdateStatus || null,
            contentVal
          ]
        );
      } catch (insertErr: any) {
        console.warn("[POST DiscussionPoint Resilient Retry]:", insertErr?.message);
        await connection.query(
          "INSERT INTO DiscussionPoints (id, meetingId, \"authorId\", concern, status, content) VALUES (?, ?, ?, ?, ?, ?)",
          [newId, id, effectiveAuthorId, concern || "Poin Diskusi", status || 'pending', contentVal]
        );
      }
      connection.release();
      res.json({ status: "success", data: { id: newId, meetingId: id } });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  });

  router.put("/api/projects/:projectId/meetings/:id/discussionPoints/:pointId", verifyProjectAccess(['*']), async (req, res) => {
    try {
      const { pointId } = req.params;
      const { parentPointId, assignTo, concern, fitur, system, surrounding, keterangan, tindakanLanjut, status, targetDate, tanggalUpdateStatus } = req.body;
      const updates = [];
      const values = [];
      if (parentPointId !== undefined) { updates.push('parentPointId = ?'); values.push(parentPointId); }
      if (assignTo !== undefined) { updates.push('assignTo = ?'); values.push(assignTo); }
      if (concern !== undefined) { updates.push('concern = ?'); values.push(concern); }
      if (fitur !== undefined) { updates.push('fitur = ?'); values.push(fitur); }
      if (system !== undefined) { updates.push('`system` = ?'); values.push(system); }
      if (surrounding !== undefined) { updates.push('surrounding = ?'); values.push(surrounding); }
      if (keterangan !== undefined) { updates.push('keterangan = ?'); values.push(keterangan); }
      if (tindakanLanjut !== undefined) { updates.push('tindakanLanjut = ?'); values.push(tindakanLanjut); }
      if (status !== undefined) { updates.push('status = ?'); values.push(status); }
      if (targetDate !== undefined) { updates.push('targetDate = ?'); values.push(targetDate); }
      if (tanggalUpdateStatus !== undefined) { updates.push('tanggalUpdateStatus = ?'); values.push(tanggalUpdateStatus); }
      
      const connection = await mysqlPool.getConnection();
      if (updates.length > 0) {
        values.push(pointId);
        await connection.query(`UPDATE DiscussionPoints SET ${updates.join(', ')} WHERE id = ?`, values);
      }
      connection.release();
      res.json({ status: "success", message: "Point updated" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  });

  router.delete("/api/projects/:projectId/meetings/:id/discussionPoints/:pointId", verifyProjectAccess(['*']), async (req, res) => {
    try {
      const { pointId } = req.params;
      const connection = await mysqlPool.getConnection();
      await connection.query("DELETE FROM DiscussionPoints WHERE id = ?", [pointId]);
      connection.release();
      res.json({ status: "success", message: "Point deleted" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  });

  // DISCUSSION POINT THREADED COMMENTS API
  const getCommentsHandler = async (req: any, res: any) => {
    try {
      const pointId = req.params.pointId || req.params.id;
      const connection = await mysqlPool.getConnection();
      const [rows] = await connection.query(
        "SELECT * FROM discussion_point_comments WHERE pointId = ? OR point_id = ? ORDER BY createdAt ASC",
        [pointId, pointId]
      );
      connection.release();
      res.json({ status: "success", data: rows });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Failed to fetch comments: " + error.message });
    }
  };

  const postCommentHandler = async (req: any, res: any) => {
    try {
      const pointId = req.params.pointId || req.params.id;
      const { userId, userName, commentText } = req.body;

      if (!commentText || !commentText.trim()) {
        return res.status(400).json({ status: "error", message: "Teks komentar wajib diisi." });
      }

      const connection = await mysqlPool.getConnection();
      const commentId = crypto.randomUUID();
      const effectiveUserId = userId || req.headers["x-user-id"] || "guest";
      const effectiveUserName = userName || "Member";
      const createdAt = new Date().toISOString();

      await connection.query(
        "INSERT INTO discussion_point_comments (id, pointId, point_id, userId, user_id, userName, user_name, commentText, comment_text, createdAt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [commentId, pointId, pointId, effectiveUserId, effectiveUserId, effectiveUserName, effectiveUserName, commentText.trim(), commentText.trim(), createdAt, createdAt]
      );
      connection.release();

      res.status(201).json({
        status: "success",
        data: {
          id: commentId,
          pointId,
          userId: effectiveUserId,
          userName: effectiveUserName,
          commentText: commentText.trim(),
          createdAt
        }
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Failed to add comment: " + error.message });
    }
  };

  router.get("/api/discussion-points/:pointId/comments", getCommentsHandler);
  router.get("/api/projects/:projectId/meetings/:meetingId/discussionPoints/:pointId/comments", getCommentsHandler);
  router.post("/api/discussion-points/:pointId/comments", postCommentHandler);
  router.post("/api/projects/:projectId/meetings/:meetingId/discussionPoints/:pointId/comments", postCommentHandler);

export default router;
