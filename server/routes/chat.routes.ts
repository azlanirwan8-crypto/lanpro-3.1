/**
 * Rute obrolan antar pengguna, termasuk simulasi balasan berbantuan AI.
 *
 * Diekstrak dari task.routes.ts. Berkas itu bukan berkas task saja: ia juga
 * menampung seluruh endpoint chat dan notifikasi — pola grab-bag yang sama
 * seperti meetings.routes.ts sebelum dipecah. Isi handler tidak diubah
 * sebaris pun; yang berpindah hanya tempatnya.
 */
import express from "express";
import crypto from "crypto";
import db from "../../src/lib/db";
import { GoogleGenAI } from "@google/genai";
import { generateContentWithFallback } from "../services/ai.service";
import { matchesCaller } from "../services/task.service";

const router = express.Router();

router.get("/api/chat/last-messages", async (req: any, res) => {
  let connection;
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ status: "error", message: "userId diperlukan." });
    }
    if (!matchesCaller(req.user, userId)) {
      return res.status(403).json({
        status: "error",
        message: "Akses ditolak: Anda hanya dapat melihat percakapan Anda sendiri.",
      });
    }
    connection = await db.getConnection();

    const [rows]: any = await connection.query(
      `SELECT m1.*, 
                CASE WHEN m1.senderId = ? THEN m1.receiverId ELSE m1.senderId END AS partnerId
         FROM Messages m1
         INNER JOIN (
             SELECT 
                 CASE WHEN senderId = ? THEN receiverId ELSE senderId END AS partnerId,
                 MAX(timestamp) as max_ts
             FROM Messages
             WHERE (senderId = ? OR receiverId = ?) AND receiverId != 'group'
             GROUP BY partnerId
         ) m2 ON (
             (m1.senderId = ? AND m1.receiverId = m2.partnerId) OR 
             (m1.receiverId = ? AND m1.senderId = m2.partnerId)
         ) AND m1.timestamp = m2.max_ts`,
      [userId, userId, userId, userId, userId, userId]
    );

    // Fetch last message for Group Chat
    const [groupRows]: any = await connection.query(
      "SELECT * FROM Messages WHERE receiverId = 'group' ORDER BY timestamp DESC LIMIT 1"
    );

    // Fetch last message for AI Assistant (lanpro-ai)
    const [aiRows]: any = await connection.query(
      "SELECT * FROM Messages WHERE (senderId = ? AND receiverId = 'lanpro-ai') OR (senderId = 'lanpro-ai' AND receiverId = ?) ORDER BY timestamp DESC LIMIT 1",
      [userId, userId]
    );

    const allRows = [...rows];
    if (groupRows && groupRows.length > 0) {
      allRows.push({
        ...groupRows[0],
        partnerId: "group",
      });
    }
    if (aiRows && aiRows.length > 0) {
      allRows.push({
        ...aiRows[0],
        partnerId: "lanpro-ai",
      });
    }

    res.json({ status: "success", data: allRows });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: GET /api/chat/last-messages error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/api/chat/messages", async (req: any, res) => {
  let connection;
  try {
    const { senderId, receiverId } = req.query;
    if (!senderId || !receiverId) {
      return res
        .status(400)
        .json({ status: "error", message: "senderId dan receiverId diperlukan." });
    }
    if (!matchesCaller(req.user, senderId) && !matchesCaller(req.user, receiverId)) {
      return res.status(403).json({
        status: "error",
        message: "Akses ditolak: Anda bukan bagian dari percakapan ini.",
      });
    }

    connection = await db.getConnection();
    let rows;
    if (receiverId === "group") {
      [rows] = await connection.query(
        "SELECT * FROM Messages WHERE receiverId = 'group' ORDER BY timestamp ASC"
      );
    } else {
      [rows] = await connection.query(
        "SELECT * FROM Messages WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?) ORDER BY timestamp ASC",
        [senderId, receiverId, receiverId, senderId]
      );
    }
    res.json({ status: "success", data: rows });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: GET /api/chat/messages error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  } finally {
    if (connection) connection.release();
  }
});

router.post("/api/chat/messages", async (req: any, res) => {
  let connection;
  try {
    const { senderId, receiverId, message, timestamp } = req.body;
    if (!senderId || !receiverId || !message) {
      return res
        .status(400)
        .json({ status: "error", message: "senderId, receiverId, dan message diperlukan." });
    }
    if (!matchesCaller(req.user, senderId)) {
      return res.status(403).json({
        status: "error",
        message: "Akses ditolak: Anda tidak dapat mengirim pesan mengatasnamakan pengguna lain.",
      });
    }

    const id = crypto.randomUUID();
    connection = await db.getConnection();
    await connection.query(
      "INSERT INTO Messages (id, senderId, receiverId, message, timestamp, `read`) VALUES (?, ?, ?, ?, ?, ?)",
      [id, senderId, receiverId, message, timestamp || new Date().toISOString(), false]
    );

    res.json({
      status: "success",
      data: { id, senderId, receiverId, message, timestamp, read: false },
    });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: POST /api/chat/messages error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  } finally {
    if (connection) connection.release();
  }
});

router.put("/api/chat/messages/read", async (req: any, res) => {
  let connection;
  try {
    const { senderId, receiverId } = req.body;
    if (!senderId || !receiverId) {
      return res
        .status(400)
        .json({ status: "error", message: "senderId dan receiverId diperlukan." });
    }
    if (!matchesCaller(req.user, receiverId)) {
      return res.status(403).json({
        status: "error",
        message: "Akses ditolak: Anda hanya dapat menandai percakapan Anda sendiri sebagai dibaca.",
      });
    }

    connection = await db.getConnection();
    await connection.query("UPDATE Messages SET `read` = ? WHERE senderId = ? AND receiverId = ?", [
      1,
      senderId,
      receiverId,
    ]);

    res.json({ status: "success", message: "Pesan berhasil ditandai sebagai dibaca." });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: PUT /api/chat/messages/read error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/api/chat/unread-counts", async (req: any, res) => {
  let connection;
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ status: "error", message: "userId diperlukan." });
    }
    if (!matchesCaller(req.user, userId)) {
      return res.status(403).json({
        status: "error",
        message: "Akses ditolak: Anda hanya dapat melihat notifikasi Anda sendiri.",
      });
    }

    connection = await db.getConnection();
    const [rows] = await connection.query(
      "SELECT senderId, COUNT(*) as count FROM Messages WHERE receiverId = ? AND `read` = false GROUP BY senderId",
      [userId]
    );
    res.json({ status: "success", data: rows });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: GET /api/chat/unread-counts error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  } finally {
    if (connection) connection.release();
  }
});

router.post("/api/chat/simulate-reply", async (req, res) => {
  try {
    const { senderId, receiverId, message, senderName, senderRole } = req.body;
    if (!senderId || !receiverId || !message) {
      return res
        .status(400)
        .json({ status: "error", message: "senderId, receiverId, dan message diperlukan." });
    }

    // 1. Get sender info (who is replying)
    const replySenderName = senderName || "Rekan Tim";
    const replySenderRole = senderRole || "user";

    // 2. Try using Gemini API first
    let replyText = "";
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey: apiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });

        const isAiAssistant = senderId === "lanpro-ai";
        const prompt = isAiAssistant
          ? `Anda adalah "LanPro AI Assistant", asisten kecerdasan buatan super pintar, ramah, dan solutif di platform manajemen proyek SDLC "LanPro".
Anda baru saja menerima pesan dari pengguna: "${message}"

Berikan jawaban yang membantu, profesional, dan mengesankan dalam Bahasa Indonesia yang santai, modern, dan sopan (gaya tech startup Jakarta).
Berikan saran praktis seputar manajemen tugas, debugging, figma, database, atau motivasi kerja.
Jaga agar jawaban tetap ringkas dan padat (maksimal 2-3 kalimat saja) seperti pesan chat instan di Slack/Teams. Jangan gunakan kata pengantar atau tanda kutip, langsung tulis balasannya.`
          : `Anda adalah rekan kerja tim profesional bernama "${replySenderName}" dengan peran "${replySenderRole}" di tim proyek "LanPro" (sebuah Platform manajemen SDLC kelas profesional).
Anda baru saja menerima pesan chat berikut dari rekan Anda:
"${message}"

Tolong berikan balasan chat yang sangat realistis, ramah, profesional, menggunakan Bahasa Indonesia yang santai tapi sopan (seperti bahasa profesional startup/tech Jakarta).
Tanggapi pesan tersebut secara langsung dan relevan sesuai dengan peran Anda (${replySenderRole}):
- Jika Anda adalah Siti Rahma (IT Head), fokuslah pada arsitektur, database, pipeline release, performa, atau code quality.
- Jika Anda adalah Rian Hidayat (PM), fokuslah pada deadlines, sprint backlog, manajemen resiko, koordinasi tim, atau Story Points.
- Jika Anda adalah Budi Santoso (Developer), bicarakan tentang debugging, penulisan kode, progress tugas teknis, pull request, atau tantangan implementasi.
- Jika Anda adalah Dewi Lestari (UI/UX Designer), bicarakan tentang estetika layout, kontras warna, figma, aset visual, responsive web, atau feedback user experience.

Balasan Anda harus singkat (1-3 kalimat saja) layaknya pesan instan di Slack atau WA, jangan terlalu formal atau kaku. Jangan ada kata pengantar atau tanda kutip, langsung tulis balasannya saja.`;

        const response = await generateContentWithFallback(ai, {
          model: "gemini-flash-latest",
          contents: prompt,
          config: {
            temperature: 0.8,
          },
        });

        if (response && response.text) {
          replyText = response.text.trim();
        }
      } catch (geminiError) {
        console.warn(
          "[SIMULATION_API] Gagal menggunakan Gemini API, beralih ke fallback:",
          geminiError
        );
      }
    }

    // 3. Fallback smart responses if Gemini is not available or failed
    if (!replyText) {
      const role = String(replySenderRole).toLowerCase();
      let options = [
        "Halo! Terima kasih atas pesannya. Pesan Anda sudah saya terima dan akan segera saya pelajari kembali. Selamat bekerja!",
        "Siap, dipahami. Mari kita tuntaskan sprint ini dengan baik!",
        "Oke, nanti kita bahas detailnya saat sinkronisasi ya.",
      ];

      if (role.includes("head") || role.includes("architect") || replySenderName.includes("Siti")) {
        options = [
          "Halo! Saya sedang mereview skema database terbaru dan integrasi gateway. Ada hal spesifik yang ingin dikoordinasikan terkait modul core platform?",
          "Terima kasih infonya. Terkait pipeline deployment, tolong pastikan port 3000 sudah terkonfigurasi dengan benar di nginx proxy ya.",
          "Bagus sekali. Rencana migrasi tabel sudah aman, kita akan eksekusi setelah testing di staging selesai. Kabari jika butuh bantuan debug.",
          "Saya sedang melihat laporan audit logs untuk aktivitas perubahan skema. Kita perlu memitigasi kemungkinan downtime pada release berikutnya.",
        ];
      } else if (
        role.includes("manager") ||
        role.includes("pm") ||
        replySenderName.includes("Rian")
      ) {
        options = [
          "Halo! Terkait sprint backlog kita minggu ini, apakah ada hambatan (blocker) yang perlu kita diskusikan bersama?",
          "Siap, terima kasih atas updatenya. Tolong pastikan Story Points di task diupdate ya agar velocity sprint kita terpantau presisi.",
          "Untuk milestone rilis hybrid berikutnya, saya sedang mengoordinasikan jadwal dengan stakeholders. Tetap semangat rekan-rekan!",
          "Bisa tolong siapkan ringkasan progres untuk bahan meeting besok pagi? Cukup 3 poin utama saja.",
        ];
      } else if (
        role.includes("user") ||
        role.includes("dev") ||
        replySenderName.includes("Budi")
      ) {
        options = [
          "Siap mas/mbak! Saya sedang fokus memperbaiki bug Navbar di Safari mobile dulu ya. Setelah ini selesai, saya langsung lanjut ke task dependensi berikutnya.",
          "Aman! Tadi saya sudah coba pull code terbaru, jalurnya lancar tanpa konflik. Ada bagian kode tertentu yang perlu saya bantu review?",
          "Untuk integrasi REST API, saya sedang mencocokkan payload JSON-nya. Sejauh ini aman, tinggal nunggu approval pull request dari tim lead.",
          "Waduh, tadi sempat ada error koneksi DB di lokal saya, tapi sekarang sudah teratasi setelah diswitch ke fallback JSON local. Thank you infonya!",
        ];
      } else if (
        role.includes("viewer") ||
        role.includes("design") ||
        replySenderName.includes("Dewi")
      ) {
        options = [
          "Halo! Desain mockup figma untuk flow kolaborasi dan bagan timeline waterfall sudah saya finalisasi. Silakan dicek kontras warna dan responsive layout-nya.",
          "Terima kasih sarannya. Saya setuju, ukuran font di card details memang agak kekecilan di mobile screen. Akan segera saya sesuaikan ukuran padding-nya.",
          "Untuk layout visual dashboard baru, saya menggunakan pendekatan monokromatik abu-abu gelap dengan aksen oranye terang agar terkesan modern dan tangguh.",
          "Siap! Jika butuh aset SVG baru atau panduan layout bento grid, langsung colek saya saja ya.",
        ];
      }

      const randomIndex = Math.floor(Math.random() * options.length);
      replyText = options[randomIndex];
    }

    // 4. Save simulated reply to Database
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const connection = await db.getConnection();
    await connection.query(
      "INSERT INTO Messages (id, senderId, receiverId, message, timestamp, `read`) VALUES (?, ?, ?, ?, ?, ?)",
      [id, senderId, receiverId, replyText, timestamp, false]
    );
    connection.release();

    res.json({
      status: "success",
      data: {
        id,
        senderId,
        receiverId,
        message: replyText,
        timestamp,
        read: false,
      },
    });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: POST /api/chat/simulate-reply error:", error);
    res
      .status(500)
      .json({ status: "error", message: "Gagal membuat simulasi balasan: " + error.message });
  }
});

export default router;
