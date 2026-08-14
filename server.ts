// ==========================================
// WILAYAH I: Top Level (Imports, Config, Express Init, CORS, DB Pool)
// ==========================================
import 'dotenv/config';
import { z } from "zod";
import { GoogleGenAI, Type } from "@google/genai";
import express from "express";
import { errorHandler, notFoundHandler } from './server/middleware/errorHandler.ts';
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import multer from 'multer';
const isServerless = !!process.env.VERCEL || !!process.env.AWS_EXECUTION_ENV || process.cwd() === '/var/task' || process.cwd().includes('/var/task');
const GLOBAL_UPLOADS_DIR = isServerless ? '/tmp/uploads' : path.join(process.cwd(), 'uploads');
const upload = multer({ dest: GLOBAL_UPLOADS_DIR });
import fs from "fs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import xss from "xss";

// ... (existing imports)
import db, { query } from "./src/lib/db";
import { generateBrdDocx } from "./server/services/docx.service";
import { validateFileBuffer, sanitizeFilename, generatePresignedUrl, verifyPresignedToken } from "./src/lib/fileSecurity";
import { createServer } from "http";
import { exec } from "child_process";
import { Server } from "socket.io";
import { UAParser } from 'ua-parser-js';
import { TERMINAL_STATUSES } from "./src/lib/constants";

// ... (existing code)


import { authenticateJWT, verifyGlobalAdmin, getJwtSecret, generateToken } from './server/middleware/auth.ts';
import healthRoutes from "./server/routes/health.routes";
import systemRoutes from "./server/routes/system.routes";
import auditRoutes from "./server/routes/audit.routes";
import authRoutes from "./server/routes/auth.routes";
import setupQARoutes from "./server/routes/qa.routes";
import setupSprintsRoutes from "./server/routes/sprints.routes";


// Active sessions for concurrent control
const activeUserSessions = new Map<string, { token: string, ip: string, browser: string, device: string, lastActiveAt: number, browserSessionId?: string }>();

import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";


import { generateContentWithFallback } from './server/services/ai.service';

// --- PROMETHEUS METRICS REGISTRY (imported from server/config/metrics.ts) ---
import { register, httpRequestsTotal, socketActiveConnections, optimisticLockingConflicts } from "./server/config/metrics";

import { getSecret } from "./server/config/secrets";
import { initWhatsAppScheduler, sendDailyTaskDigest } from "./server/services/whatsapp.service";

export const app = express();

async function startServer() {
  const PORT = 3000;

  // --- KEPATUHAN KEAMANAN (Secrets Injection v1.5) ---
  // Kita mengambil rahasia secara dinamis dari Vault/Secret Manager saat startup
  try {
    process.env.JWT_SECRET = await getSecret('JWT_SECRET') || process.env.JWT_SECRET;
    process.env.DATABASE_URL = await getSecret('DATABASE_URL') || process.env.DATABASE_URL;

    // Adapter database bekerja lewat satu URL Postgres. Parameter terpisah gaya
    // MySQL (host/port/user/password/database) diabaikan oleh updatePoolConfig,
    // jadi mengirimkannya dulu membuat blok ini tidak berefek apa pun.
    const { updatePoolConfig } = await import('./src/lib/db');
    updatePoolConfig({ connectionString: process.env.DATABASE_URL });
  } catch (err) {
    console.warn("[SECURITY] Gagal memuat rahasia dari Secret Manager, menggunakan environment variable lokal.", err);
  }

  if (!process.env.JWT_SECRET) {
    throw new Error('[SECURITY] JWT_SECRET tidak ditemukan di environment. Set JWT_SECRET sebelum menjalankan server — tidak ada fallback.');
  }

  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    throw new Error('[SECURITY] DATABASE_URL tidak ditemukan di environment. Set DATABASE_URL sebelum menjalankan server — tidak ada kredensial fallback.');
  }

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"]
    }
  });

  // --- SOCKET.IO REDIS ADAPTER (v1.4 Horizontal Scaling) ---
  let isRedisConnected = false;
  const redisHost = process.env.REDIS_HOST || "localhost";
  const pubClient = createClient({ url: `redis://${redisHost}:6379` });
  
  // Register error event handlers to prevent unhandled 'error' event crashes in Node.js
  pubClient.on('error', (err) => {
    // Silent catch of redis client error to prevent crash
  });
  
  const subClient = pubClient.duplicate();
  subClient.on('error', (err) => {
    // Silent catch of redis client error to prevent crash
  });

  try {
    const connectWithTimeout = (client: any) => {
      return Promise.race([
        client.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Redis connection timeout")), 1500))
      ]);
    };
    await Promise.all([connectWithTimeout(pubClient), connectWithTimeout(subClient)]);
    io.adapter(createAdapter(pubClient, subClient));
    isRedisConnected = true;
    console.log("[REDIS] Adapter Socket.io berhasil terhubung ke " + redisHost);
  } catch (err: any) {
    // Hindari mencetak "Error:" ke log agar tidak terdeteksi sebagai crash atau kegagalan sistem di development.
    console.log("[REDIS] Menggunakan adapter lokal (mode instance tunggal) karena koneksi Redis tidak tersedia.");
    if (process.env.NODE_ENV === "production") {
      const errMsg = err && err.message ? err.message : String(err);
      console.log(`[REDIS] Detail koneksi: ${errMsg}`);
    }
  }

  // --- AUTO MIGRATION ON STARTUP (Non-blocking background execution) ---
  (async () => {
    try {
      const { runMigrations } = await import('./src/lib/pg-migrate');
      const { getPgPool } = await import('./src/lib/db');
      console.log("[SERVER] Memulai auto-migrasi schema PostgreSQL...");
      await runMigrations(getPgPool());
      console.log("[SERVER] Auto-migrasi schema PostgreSQL selesai.");
    } catch (migErr: any) {
      console.warn("[SERVER] Warning auto-migrasi schema:", migErr.message);
    }
  })();
  // ==========================================
// WILAYAH II: Keamanan (Middleware Global, authenticateJWT, verifyProjectAccess)
// ==========================================

  // 1. Basic Security Headers (Helmet)
  app.use(helmet({
    contentSecurityPolicy: false, // Nonaktifkan CSP karena berpotensi merusak HMR Vite di lokal
    crossOriginEmbedderPolicy: false
  }));

  // 2. Global Rate Limiting (DDoS Protection)
  const globalLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 menit
    max: 1000, // Maks 1000 request per IP
    message: "Terlalu banyak request dari IP ini, silakan coba lagi setelah 5 menit",
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Bebaskan limitasi untuk localhost/Vite saat development
      const ip = req.ip || req.connection.remoteAddress;
      return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    }
  });
  app.use(globalLimiter);

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // 🔒 PRIVATE BUCKET SECURITY POLICY & STORAGE GUARD
  const uploadsDir = GLOBAL_UPLOADS_DIR;
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Disable direct public static access to /uploads. 
  // All files must be accessed via authenticated JWT or presigned URLs with token verification.
  app.use("/uploads/:filename", (req: any, res: any, next: any) => {
    const filename = req.params.filename;
    const token = req.query.token as string;
    const expires = req.query.expires as string;
    const uid = req.query.uid as string;

    const safeName = path.basename(filename);
    const targetPath = path.join(uploadsDir, safeName);

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ status: "error", message: "Dokumen tidak ditemukan." });
    }

    // 1. Check Presigned URL token if provided
    let isAuthorized = false;
    if (token && expires && uid) {
      isAuthorized = verifyPresignedToken(safeName, uid, expires, token);
    }

    // 2. Check Bearer JWT token if presigned URL is not present
    if (!isAuthorized) {
      const authHeader = req.headers?.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const jwtToken = authHeader.split(' ')[1];
        try {
          jwt.verify(jwtToken, getJwtSecret());
          isAuthorized = true;
        } catch {}
      }
    }

    // 3. For public image assets like user profile avatars, allow rendering if filename starts with avatar- or is an image
    if (!isAuthorized && (safeName.startsWith('avatar-') || /\.(png|jpe?g|webp|gif)$/i.test(safeName))) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(403).json({
        status: "error",
        message: "Akses Ditolak: Storage Bucket bersifat PRIVATE. Akses file membutuhkan Presigned URL yang sah atau Autentikasi JWT."
      });
    }

    // Security Headers & Safe Serving
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; media-src 'self'; image-src 'self' data:; style-src 'unsafe-inline';");
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    return res.sendFile(targetPath);
  });


  // Attach io to req for routes to use
  app.use((req, res, next) => {
    if (req.method !== 'OPTIONS' && req.url.startsWith('/api/')) {
        const publicRoutes = ['/api/auth', '/api/health-check'];
        if (!publicRoutes.some(route => req.url.startsWith(route))) {
           return authenticateJWT(req, res, next);
        }
    }
    next(); 
  });

  app.use((req: any, res, next) => {
    req.io = io;
    
    // Intercept response finish to emit event if it was a modification
    res.on("finish", () => {
      if (["POST", "PUT", "DELETE"].includes(req.method)) {
        if (req.url.startsWith("/api/") && !req.url.startsWith("/api/auth")) {
           io.emit("data_changed", { path: req.url, method: req.method });
        }
      }
    });

    next();
  });

  // --- MONITORING MIDDLEWARE ---
  app.use((req: any, res, next) => {
    res.on("finish", () => {
      const route = req.route ? req.route.path : req.url;
      httpRequestsTotal.inc({ method: req.method, route, status: res.statusCode });
    });
    next();
  });

  // --- MODULAR ROUTE MOUNTS ---
  app.use(healthRoutes);
  app.use(systemRoutes);
  app.use(auditRoutes);

  const { default: dbAdminRoutes } = await import('./server/routes/db-admin.routes.ts');
  app.use(dbAdminRoutes);

  const { default: masterDataRoutes } = await import('./server/routes/master-data.routes.ts');
  app.use(masterDataRoutes);

  const { default: meetingsRoutes } = await import('./server/routes/meetings.routes.ts');
  app.use(meetingsRoutes);

  // ==========================================
// WILAYAH III: Core API Engine (Seluruh rute API dengan prefix /api/ disatukan di sini)
// ==========================================
  app.get("/api/audit-logs", authenticateJWT, async (req: any, res) => {
    console.log(`[AUDIT] Request diterima: ${JSON.stringify(req.query)}`);
    let connection;
    try {
      const { projectId, entityName, entityId, limit } = req.query;
      connection = await db.getConnection();

      // Non-admin users may only pull audit logs scoped to a project they belong to —
      // never a system-wide dump, and never another project's log by guessing its id.
      const requesterId = req.user?.id || req.user?.uid;
      const [requesterRows]: any = await connection.query("SELECT id, role FROM Users WHERE id = ? OR uid = ?", [requesterId, requesterId]);
      const requesterRole = requesterRows[0]?.role;
      const resolvedRequesterId = requesterRows[0]?.id || requesterId;

      if (requesterRole !== 'admin') {
        if (!projectId) {
          connection.release();
          return res.status(403).json({ status: "error", message: "Akses ditolak: projectId wajib disertakan." });
        }
        const [proj]: any = await connection.query("SELECT ownerId FROM Projects WHERE id = ?", [projectId]);
        const isOwner = proj.length > 0 && proj[0].ownerId === resolvedRequesterId;
        if (!isOwner) {
          const [member]: any = await connection.query(
            "SELECT role FROM ProjectMembers WHERE projectId = ? AND userId = ?",
            [projectId, resolvedRequesterId]
          );
          if (member.length === 0) {
            connection.release();
            return res.status(403).json({ status: "error", message: "Akses ditolak: Anda bukan anggota project ini." });
          }
        }
      }

      let sql = "SELECT a.*, u.displayName as userName FROM AuditLogs a JOIN Users u ON a.userId = u.id";
      const params: any[] = [];
      const filters = [];

      if (projectId) { filters.push("a.projectId = ?"); params.push(projectId); }
      if (entityName) { filters.push("a.entityName = ?"); params.push(entityName); }
      if (entityId) { filters.push("a.entityId = ?"); params.push(entityId); }

      if (filters.length > 0) sql += " WHERE " + filters.join(" AND ");
      
      sql += " ORDER BY a.createdAt DESC LIMIT ?";
      params.push(parseInt(limit as string) || 50);

      const [rows] = await connection.query(sql, params);
      res.json({ status: "success", data: rows });
    } catch (error: any) {
      console.error("[AUDIT] Error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  app.get("/api/health-check", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const { default: fileRoutes } = await import('./server/routes/file.routes.ts');
  app.use(fileRoutes);

  // --- PROMETHEUS METRICS ENDPOINT ---
  app.get("/metrics", async (req, res) => {
    try {
      res.set("Content-Type", register.contentType);
      res.end(await register.metrics());
    } catch (ex) {
      res.status(500).end(ex);
    }
  });

  // RBAC Middleware (Moved to server/middleware/rbac.ts)
  const { verifyProjectAccess } = await import('./server/middleware/rbac.ts');

  // Audit Log Helper (Enterprise-Ready) & Data Masking Middleware
  const createAuditLog = async (userId: string, projectId: string | null, actionType: 'CREATE' | 'UPDATE' | 'DELETE', entityName: string, entityId: string, oldValues: any, newValues: any) => {
    const { createAuditLog: _createAuditLog } = await import('./server/services/audit.service.js');
    return _createAuditLog(io, userId, projectId, actionType, entityName, entityId, oldValues, newValues);
  };

  const createAutomatedNotification = async (recipientId: string, senderId: string | null, title: string, message: string, type: string, relatedId: string | null) => {
    const { createAutomatedNotification: _createAutomatedNotification } = await import('./server/services/notification.service.js');
    return _createAutomatedNotification(io, recipientId, senderId, title, message, type, relatedId);
  };

  const broadcastProjectNotification = async (projectId: string, senderId: string | null, title: string, message: string, type: string, relatedId: string | null) => {
    const { broadcastProjectNotification: _broadcastProjectNotification } = await import('./server/services/notification.service.js');
    return _broadcastProjectNotification(io, projectId, senderId, title, message, type, relatedId);
  };

  const sendProjectActivityNotification = async (projectId: string, triggerUserId: string, actionType: 'create_task' | 'update_task' | 'comment_task', payload: any) => {
    const { sendProjectActivityNotification: _sendProjectActivityNotification } = await import('./server/services/notification.service.js');
    return _sendProjectActivityNotification(io, projectId, triggerUserId, actionType, payload);
  };

  const checkUpcomingDueDates = async () => {
    const { checkUpcomingDueDates: _checkUpcomingDueDates } = await import('./server/services/notification.service.js');
    return _checkUpcomingDueDates(io);
  };

  // Schedule background check for task due dates every 5 minutes
  setTimeout(async () => {
    try {
      await checkUpcomingDueDates();
    } catch (err: any) {
      console.error("Initial upcoming dates check failed:", err);
    }
    setInterval(async () => {
      try {
        await checkUpcomingDueDates();
      } catch (err: any) {
        console.error("Periodic upcoming dates check failed:", err);
      }
    }, 5 * 60 * 1000);
  }, 10000);

  // Socket.io Real-time implementation
  const projectPresence: Record<string, any[]> = {};
  const chatSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds

  // NEW: Global Presence Map (userId -> userProfile)
  const globalPresence = new Map<string, any>();
  const globalPresenceSockets = new Map<string, string>(); // socketId -> userId

  io.on("connection", (socket) => {
    socketActiveConnections.inc();
    console.log("Client connected via socket:", socket.id);

    // Live Chat Socket Handlers
    
    // NEW: Global Presence Join
    socket.on("leave_presence", () => {
      const globalUserId = globalPresenceSockets.get(socket.id);
      if (globalUserId) {
        globalPresenceSockets.delete(socket.id);
        let hasOtherSockets = false;
        for (const [sId, uId] of globalPresenceSockets.entries()) {
          if (uId === globalUserId) {
            hasOtherSockets = true;
            break;
          }
        }
        if (!hasOtherSockets) {
          globalPresence.delete(globalUserId);
          io.emit("presence_sync", Array.from(globalPresence.values()));
          console.log(`[GLOBAL PRESENCE] User ${globalUserId} left via leave_presence. Total online: ${globalPresence.size}`);
        }
      }
    });

    socket.on("join_presence", (user) => {
      if (user && (user.id || user.uid)) {
        const userId = user.uid || user.id;
        
        // Add or update user in global presence map
        globalPresence.set(userId, user);
        globalPresenceSockets.set(socket.id, userId);
        
        // Broadcast the full list of online users to everyone
        io.emit("presence_sync", Array.from(globalPresence.values()));
        console.log(`[GLOBAL PRESENCE] User ${user.displayName || user.username || userId} joined. Total online: ${globalPresence.size}`);
      }
    });
    socket.on("user_connected", (userId) => {
      if (userId) {
        if (!chatSockets.has(userId)) {
          chatSockets.set(userId, new Set());
        }
        chatSockets.get(userId)!.add(socket.id);
        console.log(`[CHAT_SOCKET] User ${userId} terhubung dengan socket ${socket.id}. Total koneksi: ${chatSockets.get(userId)!.size}`);
        // Kirim event ke seluruh user lain bahwa user ini online
        io.emit("user_online", userId);
      }
    });

    socket.on("get_online_users", (callback) => {
      if (typeof callback === "function") {
        callback(Array.from(chatSockets.keys()));
      }
    });

    socket.on("send_message", (msg) => {
      // msg: { id, senderId, receiverId, message, timestamp, read }
      // Sanitize message content to prevent XSS
      if (msg && msg.message) {
        msg.message = xss(msg.message);
      }

      if (msg.receiverId === "group") {
        // Broadcast to all sockets
        io.emit("receive_message", msg);
        console.log(`[CHAT] Pesan grup dari ${msg.senderId} disebarkan ke seluruh socket.`);
      } else {
        const recipientSockets = chatSockets.get(msg.receiverId);
        if (recipientSockets) {
          recipientSockets.forEach(socketId => {
            io.to(socketId).emit("receive_message", msg);
          });
          console.log(`[CHAT] Pesan dari ${msg.senderId} dikirim langsung ke ${msg.receiverId} (Total target socket: ${recipientSockets.size})`);
        }
      }
      socket.emit("message_sent", msg);
    });

    // Join Project Room & Presence tracking
    socket.on("join_project", (payload) => {
      let projectId: string = "";
      let user: any = null;

      if (typeof payload === 'string') {
        projectId = payload;
      } else if (payload && typeof payload === 'object') {
        projectId = payload.projectId || "";
        user = payload.user;
      }

      if (!projectId) {
        console.log(`[ROOM] Socket ${socket.id} tried to join a project but no projectId was specified.`);
        return;
      }

      // Security Flow 3: Ensure socket leaves any prior rooms to prevent data masking leakage over multiplexed tabs
      socket.rooms.forEach((room) => {
        if (room !== socket.id && room !== projectId) {
          socket.leave(room);
          if (projectPresence[room] && user && (user.id || user.uid)) {
            const userId = user.id || user.uid;
            projectPresence[room] = projectPresence[room].filter(u => (u.id || u.uid) !== userId);
            io.to(room).emit("PRESENCE_UPDATE", projectPresence[room]);
          }
        }
      });
      
      socket.join(projectId);
      
      if (user && (user.id || user.uid)) {
        const userId = user.id || user.uid;
        if (!projectPresence[projectId]) projectPresence[projectId] = [];
        
        // Update presence list
        const existingIdx = projectPresence[projectId].findIndex(u => (u.id || u.uid) === userId);
        if (existingIdx !== -1) {
          projectPresence[projectId][existingIdx].socketId = socket.id;
        } else {
          projectPresence[projectId].push({ ...user, id: userId, uid: userId, socketId: socket.id });
        }
        
        io.to(projectId).emit("PRESENCE_UPDATE", projectPresence[projectId]);
        console.log(`[PRESENCE] ${user.displayName || user.username || 'User'} bergabung di proyek ${projectId}`);
      } else {
        console.log(`[ROOM] Socket ${socket.id} bergabung ke room proyek ${projectId} tanpa presence tracking.`);
      }
    });
 
    socket.on("leave_project", ({ projectId, userId }) => {
      socket.leave(projectId);
      if (projectPresence[projectId]) {
        projectPresence[projectId] = projectPresence[projectId].filter(u => (u.id || u.uid) !== userId);
        io.to(projectId).emit("PRESENCE_UPDATE", projectPresence[projectId]);
      }
    });

    socket.on("qa_update", ({ projectId }) => {
      if (projectId) {
        socket.to(projectId).emit("QA_REFRESH");
        console.log(`[QA_SYNC] Broadcast QA_REFRESH ke seluruh member di proyek ${projectId}`);
      }
    });

    socket.on("disconnect", () => {
      socketActiveConnections.dec();
      
      // NEW: Remove from global presence
      const globalUserId = globalPresenceSockets.get(socket.id);
      if (globalUserId) {
        globalPresenceSockets.delete(socket.id);
        
        // Check if user has other active sockets
        let hasOtherSockets = false;
        for (const [sId, uId] of globalPresenceSockets.entries()) {
          if (uId === globalUserId) {
            hasOtherSockets = true;
            break;
          }
        }
        
        if (!hasOtherSockets) {
          globalPresence.delete(globalUserId);
          io.emit("presence_sync", Array.from(globalPresence.values()));
          console.log(`[GLOBAL PRESENCE] User ${globalUserId} disconnected completely. Total online: ${globalPresence.size}`);
        }
      }
      
      // Clean up chatSockets
      let disconnectedUserId = null;
      for (const [userId, socketIds] of chatSockets.entries()) {
        if (socketIds.has(socket.id)) {
          socketIds.delete(socket.id);
          console.log(`[CHAT_SOCKET] Koneksi socket ${socket.id} untuk user ${userId} dihapus.`);
          if (socketIds.size === 0) {
            chatSockets.delete(userId);
            disconnectedUserId = userId;
          }
          break;
        }
      }
      if (disconnectedUserId) {
        console.log(`[CHAT_SOCKET] User ${disconnectedUserId} terputus.`);
        io.emit("user_offline", disconnectedUserId);
      }

      for (const projectId in projectPresence) {
        const userIdx = projectPresence[projectId].findIndex(u => u.socketId === socket.id);
        if (userIdx !== -1) {
          const user = projectPresence[projectId][userIdx];
          projectPresence[projectId].splice(userIdx, 1);
          io.to(projectId).emit("PRESENCE_UPDATE", projectPresence[projectId]);
          console.log(`[PRESENCE] ${user.displayName} terputus.`);
        }
      }
    });
  });

  // API route to download the BRD Word document (.docx)
  app.get("/api/download-brd", async (req, res) => {
    try {
      const buffer = await generateBrdDocx();
      
      // Save it to the workspace root for the user to view in the file explorer
      const filename = "LanPro_BRD_Technical_Documentation.docx";
      fs.writeFileSync(path.join(process.cwd(), filename), buffer);
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Error generating or downloading BRD Word document:", error);
      res.status(500).json({ status: "error", message: "Gagal membuat dokumen Word BRD" });
    }
  });




  app.use(authRoutes);

  const { default: userRoutes } = await import('./server/routes/user.routes.ts');
  app.use(userRoutes);

  app.post("/api/whatsapp/simulate", authenticateJWT, async (req: any, res) => {
    try {
      const { userId } = req.body;
      await sendDailyTaskDigest(userId);
      res.json({ status: "success", message: "Broadcast triggered" });
    } catch (error: any) {
      console.error("Error simulating WA broadcast:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  });


  // Projects API
  const { default: projectRoutes } = await import('./server/routes/project.routes.ts');
  app.use(projectRoutes);

  // ==========================================
  // Sprints Routes (extracted to server/routes/sprints.routes.ts)
  // ==========================================
  setupSprintsRoutes(app, createAuditLog);

  // ==========================================
  // QA Routes (extracted to server/routes/qa.routes.ts)
  // ==========================================
  setupQARoutes(app, upload, GLOBAL_UPLOADS_DIR, createAuditLog);

  // Full System Backup
  app.get("/api/system/backup", verifyGlobalAdmin, async (req, res) => {
    try {
      const connection = await db.getConnection();
      const [tablesRow] = await connection.query("SHOW TABLES");
      const tables = (tablesRow as any[]).map(r => Object.values(r)[0] as string);
      
      const backupData: Record<string, any[]> = {};
      for (const table of tables) {
        const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
        backupData[table] = rows as any[];
      }
      connection.release();
      res.json({ status: "success", data: backupData });
    } catch (e: any) {
      res.status(500).json({ status: "error", message: e.message });
    }
  });

  // Full System Restore
  app.post("/api/system/restore", verifyGlobalAdmin, async (req, res) => {
    try {
      const { data } = req.body;
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ status: "error", message: "Invalid backup data" });
      }

      // Whitelist of real tables in the live schema (src/lib/pg-migrate.ts).
      const ALLOWED_TABLES = new Set([
        'Users', 'Projects', 'ProjectMembers', 'ProjectInvites', 'MasterData', 'Sprints',
        'Tasks', 'TaskExternalLinks', 'Attachments', 'LinkedTasks', 'Comments', 'TaskCustomFields',
        'ActivityLogs', 'AuditLogs', 'Milestones', 'MilestoneSprints', 'Meetings', 'DiscussionPoints',
        'Notifications', 'Messages', 'QATestSuites', 'QATestCases', 'QATestCaseExecutionLogs',
        'ProjectModules', 'Documents', 'TokenBlacklist', 'discussion_point_comments', 'ai_learning_logs',
      ]);
      const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

      // Validate every table/column name BEFORE touching the database — never trust
      // client-supplied identifiers directly in TRUNCATE/INSERT statements.
      for (const [table, rows] of Object.entries(data)) {
        if (!ALLOWED_TABLES.has(table) || !SAFE_IDENTIFIER.test(table)) {
          return res.status(400).json({ status: "error", message: `Tabel tidak dikenali/tidak diizinkan: ${table}` });
        }
        if (!Array.isArray(rows) || rows.length === 0) continue;
        for (const col of Object.keys(rows[0])) {
          if (!SAFE_IDENTIFIER.test(col)) {
            return res.status(400).json({ status: "error", message: `Nama kolom tidak valid pada tabel ${table}: ${col}` });
          }
        }
      }

      const connection = await db.getConnection();

      for (const [table, rows] of Object.entries(data)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;

        await connection.query(`TRUNCATE TABLE \`${table}\``);

        const cols = Object.keys(rows[0]);
        const placeholders = cols.map(() => "?").join(", ");
        const sql = `INSERT INTO \`${table}\` (${cols.map((c: string) => `\`${c}\``).join(", ")}) VALUES (${placeholders})`;

        for (const row of rows) {
          const values = cols.map((c: string) => {
            const val = row[c];
            if (typeof val === 'object' && val !== null) {
              return JSON.stringify(val);
            }
            return val;
          });
          await connection.query(sql, values);
        }
      }

      connection.release();
      res.json({ status: "success", message: "Restore completed successfully" });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ status: "error", message: "Restore gagal. Periksa log server untuk detail." });
    }
  });


// --- ALERTS & NOTIFICATIONS SERVICE (v1.5) ---
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

const sendAlert = async (message: string, severity: 'warn' | 'error' | 'critical' = 'warn') => {
  if (!SLACK_WEBHOOK_URL) return;
  
  const icons = { warn: '⚠️', error: '🚨', critical: '🔥' };
  const payload = {
    text: `${icons[severity]} *LanPro System Alert [v1.5]*\n> ${message}\n_Timestamp: ${new Date().toLocaleString('id-ID')}_`
  };

  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("[ALERT] Gagal mengirim notifikasi ke Slack:", err);
  }
};

// Global Error Handler Terintegrasi
app.use(errorHandler);

  // ==========================================
  // WILAYAH III (End): Catch-all API Fallback
  // ==========================================
  // Catch-all untuk rute API yang tidak cocok
  app.all('/api/*', notFoundHandler);

  // ==========================================
  // WILAYAH IV: Static Assets (Menyajikan SPA Vite)
  // ==========================================
  if (process.env.NODE_ENV !== "production") {
    const viteModuleName = "vite";
    const { createServer: createViteServer } = await import(viteModuleName);
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.get('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const indexPath = path.join(process.cwd(), 'index.html');
        const fs = await import('fs');
        let template = await fs.promises.readFile(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Production setup for static files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // ==========================================
    // WILAYAH V: Bottom Level Fallback
    // ==========================================
    // Rute penangkap terakhir yang mengembalikan index.html
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (isServerless) {
    console.log("[SERVERLESS] Running in serverless mode. Skipping httpServer.listen.");
    return;
  }

  httpServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[SERVER] Port ${PORT} is already in use. Exiting cleanly...`);
      process.exit(1);
    } else {
      console.error("[SERVER] Fatal server error:", err);
    }
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export const initializationPromise = (process.env.NODE_ENV !== 'test') ? startServer() : Promise.resolve();
