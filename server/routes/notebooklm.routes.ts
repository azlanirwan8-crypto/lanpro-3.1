/**
 * Rute integrasi NotebookLM: chat, ringkasan otomatis, dan pembuatan audio.
 *
 * Diekstrak apa adanya dari meetings.routes.ts, yang sempat menampung enam
 * domain berbeda dalam satu berkas 2.264 baris. Isi handler tidak diubah
 * sebaris pun; yang berpindah hanya tempatnya.
 */
import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { GoogleGenAI } from '@google/genai';
import { generateContentWithFallback } from '../services/ai.service';

const router = Router();

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


export default router;
