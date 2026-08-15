import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import db from "../../src/lib/db";
import { authenticateJWT, activeUserSessions, verifyGlobalAdmin } from "../middleware/auth";
import { verifyProjectAccess } from "../middleware/rbac";
import { hashPassword, verifyPassword } from "../helpers/hash";
import { createAuditLog } from "../services/audit.service";
import { broadcastProjectNotification, sendProjectActivityNotification, checkUpcomingDueDates } from "../services/notification.service";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../middleware/auth";
import { validateFileBuffer } from "../../src/lib/fileSecurity";

const AVATAR_ALLOWED_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);

/**
 * Menyaring nilai avatar yang boleh masuk ke kolom Users.
 *
 * Endpoint PUT /api/users/:id sebelumnya menulis apa pun yang dikirim klien ke
 * kolom avatar tanpa pemeriksaan. Akibatnya di produksi ditemukan satu akun
 * yang avatarnya berisi URL DOKUMEN lengkap dengan presigned token:
 *
 *   /uploads/ERD_PMB_...jpg?token=7acd39a8...&uid=1
 *
 * Dua hal salah sekaligus di sana: berkasnya bukan gambar avatar, dan token
 * akses ikut tersimpan permanen di baris pengguna — padahal token itu milik
 * uid=1, bukan pemilik akunnya.
 *
 * Hanya jalur yang dihasilkan endpoint unggah avatar yang diterima, yaitu
 * `/uploads/avatar-<sesuatu>.<ext>` tanpa query string. Nilai lain ditolak
 * menjadi null sehingga UI jatuh ke inisial nama, bukan ke gambar yang salah.
 */
export function sanitizeAvatarValue(nilai: unknown): string | null {
  if (nilai === null || nilai === undefined) return null;
  if (typeof nilai !== 'string') return null;
  const v = nilai.trim();
  if (v === '') return null;

  // Tolak query string: di situlah presigned token menumpang.
  if (v.includes('?') || v.includes('#')) return null;
  // Tolak URL absolut dan protokol apa pun (termasuk data: dan javascript:).
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v) || v.startsWith('//')) return null;
  // Tolak upaya keluar direktori.
  if (v.includes('..')) return null;

  const cocok = /^\/uploads\/(avatar-[A-Za-z0-9._-]+)\.([A-Za-z0-9]+)$/.exec(v);
  if (!cocok) return null;
  if (!AVATAR_ALLOWED_EXT.has(cocok[2].toLowerCase())) return null;
  return v;
}

/**
 * Menghapus berkas avatar lama saat pengguna menggantinya.
 *
 * Tanpa ini setiap penggantian meninggalkan berkas yatim permanen di uploads/.
 * Kegagalan penghapusan sengaja tidak dilempar: gagal membersihkan berkas lama
 * tidak boleh menggagalkan pembaruan avatar yang sudah tersimpan di database.
 */
function hapusAvatarLama(urlLama: unknown, urlBaru: string): void {
  const lama = sanitizeAvatarValue(urlLama);
  if (!lama || lama === urlBaru) return;
  try {
    const namaBerkas = path.basename(lama);
    const jalur = path.join(GLOBAL_UPLOADS_DIR, namaBerkas);
    // Pastikan hasil join benar-benar masih di dalam direktori unggahan.
    if (!jalur.startsWith(GLOBAL_UPLOADS_DIR)) return;
    if (fs.existsSync(jalur)) {
      fs.unlinkSync(jalur);
      console.log(`[AVATAR] Berkas lama dihapus: ${namaBerkas}`);
    }
  } catch (err) {
    console.warn('[AVATAR] Gagal menghapus berkas lama:', err);
  }
}

const isServerless = !!process.env.VERCEL || !!process.env.AWS_EXECUTION_ENV || process.cwd() === '/var/task' || process.cwd().includes('/var/task');
const GLOBAL_UPLOADS_DIR = isServerless ? '/tmp/uploads' : path.join(process.cwd(), 'uploads');
if (!fs.existsSync(GLOBAL_UPLOADS_DIR)) {
  fs.mkdirSync(GLOBAL_UPLOADS_DIR, { recursive: true });
}
const upload = multer({ dest: GLOBAL_UPLOADS_DIR, limits: { fileSize: 5 * 1024 * 1024 } });

const isRedisConnected = false;
const pubClient: any = null;
const globalPresence = new Map<string, any>();

const query = async (sql: string, params?: any[]) => {
  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query(sql, params);
    return rows;
  } finally {
    connection.release();
  }
};

const router = express.Router();

  router.post("/api/users/heartbeat", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ status: "error" });
      const parts = authHeader.split(" ");
      if (parts.length < 2) return res.status(401).json({ status: "error" });
      const token = parts[1];
      const decoded = jwt.verify(token, getJwtSecret()) as any;
      const userId = decoded.id;
      
      const connection = await db.getConnection();
      await connection.query(
        "UPDATE Users SET lastSeen = ? WHERE id = ?",
        [new Date().toISOString(), userId]
      );
      connection.release();
      res.json({ status: "success" });
    } catch (e) {
      // Ignore errors for heartbeat
      res.json({ status: "error", message: "Silent error" });
    }
  });

  // Resilient Presence Ping API (Fallback for Vercel Serverless)
  router.post("/api/presence/ping", authenticateJWT, async (req: any, res) => {
    let connection;
    try {
      const userId = req.user.id || req.user.uid;
      const nowStr = new Date().toISOString();
      connection = await db.getConnection();
      
      // Update lastSeen in database
      await connection.query(
        "UPDATE Users SET lastSeen = ? WHERE id = ? OR uid = ?",
        [nowStr, userId, userId]
      );
      
      // Query all users to get their latest lastSeen and presence status
      const [rows]: any = await connection.query(
        "SELECT id, uid, username, nama_lengkap, email, displayName, COALESCE(avatar_url, photoURL, avatarUrl) AS avatar_url, COALESCE(avatar_url, photoURL, avatarUrl) AS photoURL, COALESCE(avatar_url, photoURL, avatarUrl) AS avatar, role, status, lastSeen, department, position, permissions, phone FROM Users"
      );
      
      // Process database rows, parsing permissions if needed
      const processedUsers = rows.map((u: any) => {
        try { if (u.permissions && typeof u.permissions === 'string') u.permissions = JSON.parse(u.permissions); } catch (e) {}
        return u;
      });
      
      const currentUserProfile = processedUsers.find((u: any) => {
        const uId = u.uid || u.id;
        return uId && uId.toString() === userId.toString();
      });

      // Write to Redis if connected
      if (currentUserProfile && isRedisConnected) {
        try {
          await pubClient.set(`presence:user:${userId}`, JSON.stringify(currentUserProfile), { EX: 30 });
        } catch (redisErr) {
          console.warn("[REDIS] Failed to write user presence:", redisErr);
        }
      }

      // Reconcile active users: try Redis first, fallback to DB
      let activeUsers: any[] = [];
      if (isRedisConnected) {
        try {
          const keys = await pubClient.keys("presence:user:*");
          if (keys.length > 0) {
            const values = await pubClient.mGet(keys);
            values.forEach((val: any) => {
              if (val) {
                try {
                  activeUsers.push(JSON.parse(val));
                } catch (e) {}
              }
            });
          }
        } catch (redisErr) {
          console.warn("[REDIS] Failed to read presence from Redis:", redisErr);
        }
      }

      // If Redis has no active keys or is disconnected, fallback to database lastSeen within 30s
      if (activeUsers.length === 0) {
        activeUsers = processedUsers.filter((u: any) => {
          if (!u.lastSeen) return false;
          const lastSeenTime = new Date(u.lastSeen).getTime();
          return (Date.now() - lastSeenTime) < 30000; // 30 seconds TTL
        });
      }
      
      // Sync into globalPresence (for socket clients on this instance)
      activeUsers.forEach((u: any) => {
        const uid = u.uid || u.id;
        if (uid) {
          globalPresence.set(uid.toString(), u);
        }
      });
      
      res.json({
        status: "success",
        onlineUsers: activeUsers,
        allUsers: processedUsers
      });
    } catch (error: any) {
      console.error("Presence Ping Error:", error);
      res.status(500).json({ status: "error", message: error.message });
    } finally {
      if (connection) connection.release();
    }
  });

  // Resilient Presence Sync API (Redis cache for fast reconciliation across serverless instances)
  router.get("/api/presence/sync", authenticateJWT, async (req: any, res) => {
    try {
      let onlineUsers: any[] = [];
      if (isRedisConnected) {
        try {
          const keys = await pubClient.keys("presence:user:*");
          if (keys.length > 0) {
            const values = await pubClient.mGet(keys);
            values.forEach((val: any) => {
              if (val) {
                try {
                  onlineUsers.push(JSON.parse(val));
                } catch (e) {}
              }
            });
          }
        } catch (redisErr) {
          console.warn("[REDIS] Failed to sync presence from Redis, falling back to database", redisErr);
        }
      }

      // If Redis has no keys or is not connected, fallback to database lastSeen within 30s
      if (onlineUsers.length === 0) {
        const connection = await db.getConnection();
        try {
          const [rows]: any = await connection.query(
            "SELECT id, uid, username, nama_lengkap, email, displayName, COALESCE(avatar_url, photoURL, avatarUrl) AS avatar_url, COALESCE(avatar_url, photoURL, avatarUrl) AS photoURL, COALESCE(avatar_url, photoURL, avatarUrl) AS avatar, role, status, lastSeen, department, position, permissions, phone FROM Users"
          );
          const processedUsers = rows.map((u: any) => {
            try { if (u.permissions && typeof u.permissions === 'string') u.permissions = JSON.parse(u.permissions); } catch (e) {}
            return u;
          });
          onlineUsers = processedUsers.filter((u: any) => {
            if (!u.lastSeen) return false;
            const lastSeenTime = new Date(u.lastSeen).getTime();
            return (Date.now() - lastSeenTime) < 30000;
          });
        } finally {
          connection.release();
        }
      }

      res.json({
        status: "success",
        onlineUsers
      });
    } catch (error: any) {
      console.error("Presence Sync Error:", error);
      res.status(500).json({ status: "error", message: error.message });
    }
  });

  // Users API

  router.get("/api/users", async (req, res) => {
    try {
      const rows = await query("SELECT id, uid, username, nama_lengkap, email, displayName, role, status, permissions, phone, department, position, COALESCE(avatar_url, photoURL, avatarUrl) AS avatar_url, COALESCE(avatar_url, photoURL, avatarUrl) AS photoURL, COALESCE(avatar_url, photoURL, avatarUrl) AS avatar, createdAt, lastSeen FROM Users");
      res.json({ status: "success", data: rows });
    } catch (error: any) {
      console.error("LOG ANOMALI CRITICAL: GET /api/users error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server: " + error.message });
    }
  });

  router.get("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const connection = await db.getConnection();
      const [rows] = await connection.query("SELECT id, uid, username, nama_lengkap, email, displayName, role, status, permissions, phone, department, position, COALESCE(avatar_url, photoURL, avatarUrl) AS avatar_url, COALESCE(avatar_url, photoURL, avatarUrl) AS photoURL, COALESCE(avatar_url, photoURL, avatarUrl) AS avatar, createdAt, lastSeen FROM Users WHERE id = ? OR uid = ?", [id, id]);
      connection.release();
      if ((rows as any[]).length > 0) {
        let user = (rows as any[])[0];
        try { if (user.permissions) user.permissions = JSON.parse(user.permissions); } catch (e) {}
        res.json({ status: "success", data: user });
      } else {
        res.status(404).json({ status: "error", message: "User not found" });
      }
    } catch (error: any) {
      console.error("LOG ANOMALI CRITICAL: GET /api/users/:id error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server: " + error.message });
    }
  });

  // 🖼️ UPLOAD AVATAR ENDPOINT: POST /api/users/:id/avatar
  router.post("/api/users/:id/avatar", authenticateJWT, upload.single('file'), async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const currentUserId = req.user?.id || req.user?.uid;
      const currentUserRole = String(req.user?.role || req.user?.system_role || '').toLowerCase();
      const isAdmin = ['sadm', 'admn', 'admin', 'system admin', 'super admin'].includes(currentUserRole);

      if (!isAdmin && String(id) !== String(currentUserId)) {
        return res.status(403).json({
          status: "error",
          message: "Akses ditolak: Anda hanya dapat memperbarui foto profil Anda sendiri."
        });
      }

      const file = req.file || (req.files && req.files[0]);
      if (!file) {
        return res.status(400).json({
          status: "error",
          message: "File gambar avatar wajib disertakan."
        });
      }

      // Magic-byte + extension validation (same pipeline as file.routes.ts) — avatars
      // are served publicly without auth, so this is the only gate against a
      // malicious file (e.g. SVG with embedded <script>) being planted here.
      const fileBuffer = fs.readFileSync(file.path);
      const validation = validateFileBuffer(fileBuffer, file.originalname);
      const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
      if (!validation.valid || !AVATAR_ALLOWED_EXT.has(ext)) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(400).json({
          status: "error",
          message: "Foto profil harus berupa gambar (PNG, JPG, WEBP, atau GIF)."
        });
      }

      const safeFilename = `avatar-${id}-${Date.now()}.${ext}`;
      const targetPath = path.join(GLOBAL_UPLOADS_DIR, safeFilename);

      // Store in uploads directory
      fs.renameSync(file.path, targetPath);

      const avatarUrl = `/uploads/${safeFilename}`;

      const connection = await db.getConnection();

      // Ambil avatar lama SEBELUM ditimpa, supaya berkasnya bisa dibersihkan.
      const [barisLama]: any = await connection.query(
        "SELECT avatar_url, photoURL, avatarUrl FROM Users WHERE id = ? OR uid = ?",
        [id, id]
      );
      const avatarLama = barisLama?.[0]?.avatar_url || barisLama?.[0]?.photoURL || barisLama?.[0]?.avatarUrl;

      await connection.query(
        "UPDATE Users SET avatar_url = ?, photoURL = ?, avatarUrl = ? WHERE id = ? OR uid = ?",
        [avatarUrl, avatarUrl, avatarUrl, id, id]
      );

      // Dibersihkan SETELAH database diperbarui: bila penulisan gagal, berkas
      // lama harus tetap utuh agar avatar pengguna tidak hilang.
      hapusAvatarLama(avatarLama, avatarUrl);

      const [rows]: any = await connection.query(
        "SELECT id, uid, username, nama_lengkap, email, displayName, role, status, permissions, phone, department, position, COALESCE(avatar_url, photoURL, avatarUrl) AS avatar_url, COALESCE(avatar_url, photoURL, avatarUrl) AS photoURL, createdAt, lastSeen FROM Users WHERE id = ? OR uid = ?",
        [id, id]
      );
      connection.release();

      const updatedUser = rows && rows[0] ? rows[0] : { id, avatar_url: avatarUrl, photoURL: avatarUrl };

      // Socket.IO broadcast
      const io = req.app.get('io') || (req as any).io;
      if (io) {
        io.emit("data_changed", { path: `/api/users/${id}`, method: "PUT" });
        io.emit("data_changed", { path: `/api/users`, method: "GET" });
        io.emit("user_avatar_updated", { userId: id, avatar_url: avatarUrl, user: updatedUser });
      }

      return res.json({
        status: "success",
        message: "Foto profil berhasil diperbarui",
        avatar_url: avatarUrl,
        data: {
          id: id,
          avatar_url: avatarUrl,
          photoURL: avatarUrl,
          user: updatedUser
        }
      });
    } catch (error: any) {
      console.error("LOG ANOMALI CRITICAL: POST /api/users/:id/avatar error:", error);
      return res.status(500).json({
        status: "error",
        message: "Gagal memperbarui foto profil: " + error.message
      });
    }
  });

  router.put("/api/users/:id", authenticateJWT, async (req: any, res) => {
    try {
      const { id } = req.params;
      const currentUserId = req.user?.id || req.user?.uid;
      const currentUserRole = String(req.user?.role || req.user?.system_role || '').toLowerCase();
      const isAdmin = ['sadm', 'admn', 'admin', 'system admin', 'super admin'].includes(currentUserRole) || ['SADM', 'ADMN'].includes(req.user?.role);

      // If user is not admin and trying to update someone else:
      if (!isAdmin && String(id) !== String(currentUserId)) {
        return res.status(403).json({
          status: "error",
          message: "Akses ditolak: Anda hanya dapat memperbarui profil Anda sendiri."
        });
      }

      let { role, system_role, status, account_status, department, position, permissions, displayName, username, email, phone, passwordHash, password, photoURL, avatar_url } = req.body;
      // Disaring: nilai avatar dari klien tidak boleh dipercaya begitu saja.
      // Lihat catatan pada sanitizeAvatarValue.
      const effectiveAvatar = sanitizeAvatarValue(avatar_url || photoURL) ?? undefined;

      // If user is NOT admin, automatically strip out sensitive system/organizational attributes
      if (!isAdmin) {
        role = undefined;
        system_role = undefined;
        status = undefined;
        account_status = undefined;
        department = undefined;
        position = undefined;
        permissions = undefined;
      }

      const connection = await db.getConnection();
      
      const updates = [];
      const values = [];
      
      if (isAdmin) {
        if (role !== undefined) { updates.push('role = ?'); values.push(role); }
        if (status !== undefined) { updates.push('status = ?'); values.push(status); }
        if (permissions !== undefined) { updates.push('permissions = ?'); values.push(permissions ? JSON.stringify(permissions) : null); }
        if (department !== undefined) { updates.push('department = ?'); values.push(department || null); }
        if (position !== undefined) { updates.push('position = ?'); values.push(position || null); }
      }
      
      if (displayName !== undefined) { updates.push('displayName = ?'); values.push(displayName); }
      if (username !== undefined) { updates.push('username = ?'); values.push(username); }
      if (email !== undefined) { 
        updates.push('email = ?'); 
        values.push(email && email.trim() !== "" ? email.trim() : null); 
      }
      if (effectiveAvatar !== undefined) { 
        updates.push('photoURL = ?', 'avatar_url = ?', 'avatarUrl = ?'); 
        values.push(effectiveAvatar, effectiveAvatar, effectiveAvatar); 
      }
      if (phone !== undefined) { 
        updates.push('phone = ?'); 
        values.push(phone && phone.trim() !== "" ? phone.trim() : null); 
      }
      const rawPassword = passwordHash || password;
      if (rawPassword !== undefined && rawPassword !== null && rawPassword !== '') { 
        updates.push('passwordHash = ?'); 
        values.push(rawPassword.startsWith('pbkdf2$') ? rawPassword : hashPassword(rawPassword)); 
      }
      
      if (updates.length > 0) {
        values.push(id);
        await connection.query(
          `UPDATE Users SET ${updates.join(', ')} WHERE id = ?`,
          values
        );
      }
      
      connection.release();
      res.json({ status: "success", message: "User updated" });
    } catch (error: any) {
      console.error("LOG ANOMALI CRITICAL: PUT /api/users error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server: " + error.message });
    }
  });

  router.delete("/api/users/:id", authenticateJWT, verifyGlobalAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const connection = await db.getConnection();
      await connection.query("DELETE FROM Users WHERE id = ?", [id]);
      connection.release();
      res.json({ status: "success", message: "User deleted" });
    } catch (error: any) {
      console.error("LOG ANOMALI CRITICAL: DELETE /api/users error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server: " + error.message });
    }
  });

  router.put("/api/profile/update", authenticateJWT, async (req: any, res: any) => {
    try {
      const { id } = req.user;
      const { displayName, username, email, phone, currentPassword, newPassword, photoURL, avatar_url } = req.body;
      // Disaring: nilai avatar dari klien tidak boleh dipercaya begitu saja.
      // Lihat catatan pada sanitizeAvatarValue.
      const effectiveAvatar = sanitizeAvatarValue(avatar_url || photoURL) ?? undefined;
      const connection = await db.getConnection();

      const [users]: any = await connection.query("SELECT * FROM Users WHERE id = ?", [id]);
      if (users.length === 0) {
        connection.release();
        return res.status(404).json({ status: "error", message: "User not found" });
      }
      const user = users[0];

      if (currentPassword && newPassword) {
        // verifyPassword hanya menerima (password, storedHash). Argumen ketiga
        // user.username sebelumnya dikirim tetapi diabaikan diam-diam: salt
        // sudah tertanam di dalam string hash pbkdf2, dan bcrypt tidak
        // memerlukannya. Menghapusnya tidak mengubah perilaku.
        const isValid = await verifyPassword(currentPassword, user.passwordHash);
        if (!isValid) {
          connection.release();
          return res.status(400).json({ status: "error", message: "Password lama yang Anda masukkan salah!" });
        }
        await connection.query("UPDATE Users SET passwordHash = ? WHERE id = ?", [hashPassword(newPassword), id]);
      }

      const finalAvatar = effectiveAvatar !== undefined ? effectiveAvatar : (user.avatar_url || user.photoURL);

      await connection.query(
        "UPDATE Users SET displayName = ?, username = ?, email = ?, phone = ?, photoURL = ?, avatar_url = ?, avatarUrl = ? WHERE id = ?", 
        [displayName, username, email, phone, finalAvatar, finalAvatar, finalAvatar, id]
      );

      const io = req.app.get('io') || (req as any).io;
      if (io) {
        io.emit("data_changed", { path: `/api/users/${id}`, method: "PUT" });
        io.emit("data_changed", { path: `/api/users`, method: "GET" });

        // Dipancarkan juga bila avatar ikut berubah lewat jalur ini.
        //
        // Sebelumnya hanya endpoint unggah avatar yang memancarkan
        // "user_avatar_updated", sehingga perubahan avatar lewat pembaruan
        // profil tidak memicu listener khusus di klien — avatar di header baru
        // ikut berganti setelah muat ulang daftar pengguna yang lebih lambat.
        //
        // Perbandingan dengan nilai lama mencegah pancaran sia-sia saat
        // pengguna hanya mengubah nama atau nomor telepon.
        const avatarLama = user.avatar_url || user.photoURL || user.avatarUrl || null;
        if (finalAvatar && finalAvatar !== avatarLama) {
          io.emit("user_avatar_updated", {
            userId: id,
            avatar_url: finalAvatar,
            user: { ...user, avatar_url: finalAvatar, photoURL: finalAvatar, avatarUrl: finalAvatar },
          });
        }
      }

      connection.release();
      res.json({ status: "success", message: "Profile updated" });
    } catch (error: any) {
      console.error("LOG ANOMALI CRITICAL: PUT /api/profile/update error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server: " + error.message });
    }
  });



export default router;
