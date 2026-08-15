/**
 * Meetings & Discussion Points Routes
 * Handles recording uploads, analysis, meeting management, and discussion points
 */

import { Router } from 'express';
import { verifyProjectAccess } from '../middleware/rbac';
import db from '../../src/lib/db';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { validateFileBuffer, sanitizeFilename } from '../../src/lib/fileSecurity';

// Import di bawah ini hilang saat rute diekstrak dari server.ts. Simbolnya
// dulu hidup di scope server.ts, sehingga setelah dipindah menjadi nama yang
// tidak terdefinisi — 119 error TypeScript, dan ReferenceError saat endpoint
// terkait benar-benar dipanggil.
import { GoogleGenAI, Type } from '@google/genai';
import { generateContentWithFallback } from '../services/ai.service';
import { getSocketServer } from '../config/socket';
import { GLOBAL_UPLOADS_DIR } from '../config/uploads';
import { runAIPipeline } from '../services/meeting.service';
import { MULTIMODAL_ANALYSIS_SCHEMA } from '../services/meeting-ai.schema';

/**
 * Instance Socket.IO untuk memancarkan progres AI.
 *
 * Sebagian pemancaran terjadi di dalam runAIPipeline(), fungsi level-modul yang
 * berjalan sebagai proses latar setelah response terkirim, sehingga tidak punya
 * akses ke `req.io`. Registry dipakai agar seluruh titik pemancaran memakai satu
 * cara yang sama. Optional chaining di pemanggilnya membuat event terlewat
 * dengan aman bila registry belum terisi.
 */
const io = { emit: (event: string, ...args: any[]) => getSocketServer()?.emit(event, ...args) };

const router = Router();

// Upload configuration
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
          const connection = await db.getConnection();
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
        const connection = await db.getConnection();
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


  // GET: Retrieve meeting status/details (polling fallback)
  router.get("/api/v1/meetings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const connection = await db.getConnection();
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
      const connection = await db.getConnection();
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
      const connection = await db.getConnection();
      
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

      const connection = await db.getConnection();
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

      const connection = await db.getConnection();
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
          responseSchema: MULTIMODAL_ANALYSIS_SCHEMA
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
      const connection = await db.getConnection();
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

  // Meetings API
  router.get("/api/projects/:projectId/meetings", verifyProjectAccess(['*']), async (req, res) => {
    try {
      const { projectId } = req.params;
      const connection = await db.getConnection();
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
      const connection = await db.getConnection();
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
      connection = await db.getConnection();

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
      connection = await db.getConnection();
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
      connection = await db.getConnection();

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

export default router;
