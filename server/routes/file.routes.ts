import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import jwt from "jsonwebtoken";
import { authenticateJWT, getJwtSecret } from "../middleware/auth";
import {
  validateFileBuffer,
  sanitizeFilename,
  generatePresignedUrl,
  verifyPresignedToken,
} from "../../src/lib/fileSecurity";
import { simpanBerkas, bacaBerkas } from "../services/storage.service";

const router = express.Router();

const isServerless =
  !!process.env.VERCEL ||
  !!process.env.AWS_EXECUTION_ENV ||
  process.cwd() === "/var/task" ||
  process.cwd().includes("/var/task");
const GLOBAL_UPLOADS_DIR = isServerless ? "/tmp/uploads" : path.join(process.cwd(), "uploads");
const upload = multer({ dest: GLOBAL_UPLOADS_DIR });

if (!fs.existsSync(GLOBAL_UPLOADS_DIR)) {
  fs.mkdirSync(GLOBAL_UPLOADS_DIR, { recursive: true });
}

// 🛡️ SECURE UPLOAD DOCUMENT ENDPOINT (Magic Bytes, Whitelist & Private Storage)
router.post(
  "/api/v1/upload-document",
  authenticateJWT,
  upload.single("file"),
  async (req: any, res: any) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          status: "error",
          message: "Gagal Mengunggah Dokumen: File tidak ditemukan dalam request.",
        });
      }

      const fileBuffer = fs.readFileSync(file.path);
      const validation = validateFileBuffer(fileBuffer, file.originalname);

      if (!validation.valid) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(400).json({
          status: "error",
          message:
            validation.error ||
            "Gagal Mengunggah Dokumen: Format file tidak didukung atau ukuran melebihi batas maksimum (Max 10MB).",
        });
      }

      const safeFilename = validation.sanitizedName || sanitizeFilename(file.originalname);

      // Lewat lapisan penyimpanan supaya lampiran BERTAHAN antar deploy. Pada
      // driver lokal perilakunya sama seperti sebelumnya.
      await simpanBerkas(safeFilename, fileBuffer, file.mimetype);
      try {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      } catch {
        /* diabaikan */
      }

      const userId = req.user?.id || req.user?.uid || "guest";
      const presignedUrl = generatePresignedUrl(safeFilename, userId, 60);

      const tokenParts = presignedUrl.split("token=");
      const tokenValue = tokenParts.length > 1 ? tokenParts[1] : "";
      const protectedUrl = tokenValue
        ? `/uploads/${safeFilename}?token=${tokenValue}`
        : `/uploads/${safeFilename}`;

      return res.json({
        status: "success",
        message: "Dokumen berhasil diunggah dan diamankan.",
        data: {
          filename: safeFilename,
          originalName: file.originalname,
          size: fileBuffer.length,
          url: presignedUrl,
          protectedUrl,
        },
      });
    } catch (err: any) {
      console.error("POST /api/v1/upload-document error:", err);
      return res.status(500).json({
        status: "error",
        message: "Gagal Mengunggah Dokumen: Terjadi kesalahan server",
      });
    }
  }
);

// 🔒 SECURE STREAM / PRESIGNED URL ENDPOINT
router.get("/api/v1/files/secure-stream", async (req: any, res: any) => {
  try {
    const file = req.query.file as string;
    const expires = req.query.expires as string;
    const token = req.query.token as string;
    const uid = req.query.uid as string;

    if (!file) {
      return res.status(400).json({ status: "error", message: "Parameter 'file' wajib diisi." });
    }

    const safeFilename = path.basename(file);

    // Dibaca lewat lapisan penyimpanan. Pada object storage tidak ada jalur
    // berkas lokal yang bisa dikirim lewat sendFile, sehingga isinya ditarik
    // lebih dulu dan dikirim sebagai respons.
    const isiBerkas = await bacaBerkas(safeFilename);
    if (!isiBerkas) {
      return res.status(404).json({ status: "error", message: "Dokumen tidak ditemukan." });
    }

    let isAuthorized = false;
    if (token && expires && uid) {
      isAuthorized = verifyPresignedToken(safeFilename, uid, expires, token);
    }

    if (!isAuthorized && req.headers?.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        const parts = authHeader.split(" ");
        const jwtToken = parts.length > 1 ? parts[1] : null;
        if (jwtToken) {
          try {
            jwt.verify(jwtToken, getJwtSecret());
            isAuthorized = true;
          } catch {}
        }
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({
        status: "error",
        message: "Akses Ditolak: Presigned URL telah kadaluarsa atau token tidak valid.",
      });
    }

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; media-src 'self'; image-src 'self' data:; style-src 'unsafe-inline';"
    );
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");

    return res.end(isiBerkas);
  } catch (err: any) {
    return res
      .status(500)
      .json({ status: "error", message: "Terjadi kesalahan saat mengunduh dokumen." });
  }
});

export default router;
