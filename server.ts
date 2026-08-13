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
import mysqlPool, { query } from "./src/lib/db";
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


// Active sessions for concurrent control
const activeUserSessions = new Map<string, { token: string, ip: string, browser: string, device: string, lastActiveAt: number, browserSessionId?: string }>();

import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";


// Helper function to call Gemini API with model fallback and robust exponential backoff retries
async function generateContentWithFallback(ai: any, params: any) {
  const originalModel = params.model || "gemini-3.5-flash";
  
  // Define a list of fallback models to try if we encounter quota limits or persistent failures.
  // Using different model families leverages different free tier quota buckets.
  const fallbackModels: string[] = [originalModel];
  if (!fallbackModels.includes("gemini-flash-latest")) {
    fallbackModels.push("gemini-flash-latest");
  }
  if (!fallbackModels.includes("gemini-3.1-flash-lite")) {
    fallbackModels.push("gemini-3.1-flash-lite");
  }
  if (!fallbackModels.includes("gemini-3.5-flash")) {
    fallbackModels.push("gemini-3.5-flash");
  }
  if (!fallbackModels.includes("gemini-2.5-flash")) {
    fallbackModels.push("gemini-2.5-flash");
  }
  
  let lastError: any = null;
  
  for (const modelToTry of fallbackModels) {
    const finalParams = { ...params, model: modelToTry };
    const maxRetries = 3; // Retry up to 3 times for transient issues to make it highly robust
    let delayMs = 1000; // 1000ms initial retry delay
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[GEMINI] Calling model: ${modelToTry} (Attempt ${attempt}/${maxRetries})`);
        return await ai.models.generateContent(finalParams);
      } catch (error: any) {
        lastError = error;
        const errorMsg = error?.message || String(error);
        
        const isQuotaExceeded = errorMsg.includes("429") || 
                                errorMsg.includes("RESOURCE_EXHAUSTED") || 
                                errorMsg.includes("quota") ||
                                errorMsg.includes("limit") ||
                                errorMsg.includes("exceeded");
                                
        const isHighDemand = errorMsg.includes("503") || 
                             errorMsg.includes("demand") || 
                             errorMsg.includes("UNAVAILABLE");
                             
        if (isQuotaExceeded || isHighDemand) {
          console.warn(`[GEMINI] Model ${modelToTry} hit quota, high demand, or unavailability. Switching to next fallback model immediately...`);
          break; // Break the retry loop for this model and proceed to the next fallback model immediately!
        }
        
        const isTemporary = errorMsg.includes("500") || 
                            errorMsg.includes("502") || 
                            errorMsg.includes("504") ||
                            errorMsg.includes("BAD_GATEWAY") ||
                            errorMsg.includes("TIMEOUT") ||
                            errorMsg.includes("fetch failed") ||
                            errorMsg.includes("TypeError") ||
                            errorMsg.includes("network") ||
                            errorMsg.includes("ENOTFOUND") ||
                            errorMsg.includes("EAI_AGAIN") ||
                            errorMsg.includes("ECONNRESET") ||
                            errorMsg.includes("ECONNREFUSED");
                            
        if (isTemporary && attempt < maxRetries) {
          console.warn(`[GEMINI] Model ${modelToTry} failed with temporary error/network issue (Attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms. Error:`, errorMsg);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delayMs *= 2; // Exponential backoff
          continue;
        }
        
        console.error(`[GEMINI] Model ${modelToTry} failed with error: ${errorMsg}. Trying next fallback model...`);
        break; // Break the retry loop to try the next fallback model
      }
    }
    
    // Add a short delay before trying the next fallback model if there was a network/fetch issue, to allow the network to stabilize
    if (lastError && (lastError.message || String(lastError)).includes("fetch failed")) {
      console.warn(`[GEMINI] Short pause (1500ms) to let network stabilize before trying the next fallback model...`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  
  // If we exhausted all fallback models
  console.error(`[GEMINI] All fallback models failed. Final error:`, lastError?.message || lastError);
  throw lastError;
}

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
    process.env.DB_PASSWORD = await getSecret('DB_PASSWORD') || process.env.DB_PASSWORD;

    // Update pool configuration with the loaded DB_PASSWORD and fallback values
    const host = process.env.DB_HOST || 'mysql-1a54cff3-azlanirwan8-lanpro.e.aivencloud.com';
    const port = process.env.DB_PORT || '10509';
    const user = process.env.DB_USER || 'avnadmin';
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME || 'defaultdb';

    const { updatePoolConfig } = await import('./src/lib/db');
    updatePoolConfig({ host, port, user, password, database });
  } catch (err) {
    console.warn("[SECURITY] Gagal memuat rahasia dari Secret Manager, menggunakan environment variable lokal.", err);
  }

  if (!process.env.JWT_SECRET) {
    throw new Error('[SECURITY] JWT_SECRET tidak ditemukan di environment. Set JWT_SECRET sebelum menjalankan server — tidak ada fallback.');
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
      connection = await mysqlPool.getConnection();

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

  app.get("/api/projects/:projectId/sprints", verifyProjectAccess(['*']), async (req, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      connection = await mysqlPool.getConnection();
      const [rows] = await connection.query(
        "SELECT * FROM Sprints WHERE projectId = ? ORDER BY startDate ASC",
        [projectId]
      );
      res.json({ status: "success", data: rows });
    } catch (error: any) {
      console.error("LOG ANOMALI CRITICAL: GET /api/projects/:projectId/sprints error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  app.post("/api/projects/:projectId/sprints", verifyProjectAccess(['admin', 'manager', 'head']), async (req, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      const { name, goal, startDate, endDate, status } = req.body;
      connection = await mysqlPool.getConnection();
      
      // Guard Rail: Prevent Sprints in Waterfall projects
      const [proj]: any = await connection.query("SELECT category FROM Projects WHERE id = ?", [projectId]);
      if (proj.length > 0 && proj[0].category === 'Waterfall') {
        return res.status(400).json({ status: "error", message: "Metodologi Waterfall tidak mendukung pembuatan Sprint. Gunakan Milestone atau GANTT Chart." });
      }

      const newId = crypto.randomUUID();
      
      // We check if dates are handled stringly or date object
      await connection.query(
        "INSERT INTO Sprints (id, projectId, name, goal, startDate, endDate, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [newId, projectId, name, goal || '', startDate || null, endDate || null, status || 'planned']
      );
      
      const userIdStr = req.headers['x-user-id'] || 'guest';
      await createAuditLog(userIdStr as string, projectId, 'CREATE', 'Sprints', newId, null, req.body);
      
      res.json({ status: "success", data: { id: newId, projectId, name, goal, startDate, endDate, status: status || 'planned' }});
    } catch (error: any) {
      console.error("LOG ANOMALI CRITICAL: POST /api/projects/:projectId/sprints error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  app.put("/api/projects/:projectId/sprints/:id", verifyProjectAccess(['admin', 'manager', 'head']), async (req, res) => {
    let connection;
    try {
      const { id } = req.params;
      connection = await mysqlPool.getConnection();

      const [existingSprints]: any = await connection.query("SELECT * FROM Sprints WHERE id = ?", [id]);
      if (existingSprints.length === 0) {
        return res.status(404).json({ status: "error", message: "Sprint tidak ditemukan" });
      }

      const existing = existingSprints[0];
      const finalName = req.body.hasOwnProperty('name') ? req.body.name : existing.name;
      const finalGoal = req.body.hasOwnProperty('goal') ? req.body.goal : existing.goal;
      const finalStartDate = req.body.hasOwnProperty('startDate') ? req.body.startDate : existing.startDate;
      const finalEndDate = req.body.hasOwnProperty('endDate') ? req.body.endDate : existing.endDate;
      const finalStatus = req.body.hasOwnProperty('status') ? req.body.status : existing.status;
      
      await connection.query(
        "UPDATE Sprints SET name=?, goal=?, startDate=?, endDate=?, status=? WHERE id=?",
        [finalName, finalGoal, finalStartDate || null, finalEndDate || null, finalStatus, id]
      );
      
      res.json({ status: "success", message: "Sprint updated" });
    } catch (error: any) {
      console.error("LOG ANOMALI CRITICAL: PUT /api/projects/:projectId/sprints/:id error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  app.delete("/api/projects/:projectId/sprints/:id", verifyProjectAccess(['admin', 'manager', 'head']), async (req, res) => {
    try {
      const { id, projectId } = req.params;
      const connection = await mysqlPool.getConnection();
      await connection.query("DELETE FROM Sprints WHERE id = ? AND projectId = ?", [id, projectId]);
      connection.release();
      res.json({ status: "success", message: "Sprint deleted" });
    } catch (error: any) {
      console.error("LOG ANOMALI CRITICAL: DELETE /api/projects/:projectId/sprints/:id error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  });

  // ==========================================
  // QA Test Suites API
  // ==========================================
  app.get("/api/projects/:projectId/qa-test-suites", verifyProjectAccess(['*']), async (req, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      connection = await mysqlPool.getConnection();
      const [rows]: any = await connection.query(
        "SELECT * FROM QATestSuites WHERE projectId = ? ORDER BY uploadedAt DESC",
        [projectId]
      );
      res.json({ status: "success", data: rows });
    } catch (error: any) {
      console.error("GET /api/projects/:projectId/qa-test-suites error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  // POST: Save QA/user feedback to ai_learning_logs for AI continuous learning
  app.post("/api/v1/qa/ai-feedback", async (req, res) => {
    let connection;
    try {
      const { project_id, evaluation_notes } = req.body;
      if (!project_id || !evaluation_notes || !evaluation_notes.trim()) {
        return res.status(400).json({ status: "error", message: "Parameter project_id dan evaluation_notes wajib diisi." });
      }

      connection = await mysqlPool.getConnection();
      const id = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      await connection.query(
        "INSERT INTO ai_learning_logs (id, project_id, evaluation_notes, timestamp) VALUES (?, ?, ?, ?)",
        [id, project_id, evaluation_notes.trim(), timestamp]
      );

      console.log(`[QA AI FEEDBACK] Saved learning log ${id} for project ${project_id}`);
      return res.json({ status: "success", message: "Feedback berhasil disimpan ke dalam log pembelajaran AI." });
    } catch (error: any) {
      console.error("[QA AI FEEDBACK ERROR]", error);
      return res.status(500).json({ status: "error", message: "Gagal menyimpan feedback: " + error.message });
    } finally {
      if (connection) connection.release();
    }
  });

  // New Bulk Upload API Endpoint
  app.post("/api/v1/qa/test-case/bulk-upload", upload.single('file'), async (req, res) => {
    let connection;
    try {
      const { projectId, phase, uploaderName } = req.body;
      const file = req.file;
      
      if (!projectId || !phase || !file) {
        return res.status(400).json({ status: "error", message: "Missing required fields (projectId, phase, file)" });
      }

      // Security & Magic Byte Validation
      const fileBuf = fs.readFileSync(file.path);
      const fileVal = validateFileBuffer(fileBuf, file.originalname);
      if (!fileVal.valid) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(400).json({ 
          status: "error", 
          message: fileVal.error || "Gagal Mengunggah Dokumen: Format file tidak didukung atau ukuran melebihi batas maksimum (Max 10MB)." 
        });
      }
      
      // Parse Excel (exceljs — xlsx package has an unpatched high-severity
      // prototype-pollution/ReDoS advisory and is no longer maintained on npm)
      const ExcelJS = require("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(file.path);
      const worksheet = workbook.worksheets[0];
      const data: any[][] = [];
      worksheet.eachRow({ includeEmpty: true }, (row: any) => {
        data.push((row.values as any[]).slice(1));
      });

      // Validation Headers
      const headers = data[0] as string[];
      if (!headers || headers.length < 4) {
         return res.status(400).json({ status: "error", message: "Format kolom tidak sesuai standar (Nama Judul, Deskripsi, Hasil Diharapkan, Level)" });
      }
      
      const expectedHeaders = ["Nama Judul", "Deskripsi", "Hasil Diharapkan", "Level"];
      let headerValid = true;
      for (let i = 0; i < expectedHeaders.length; i++) {
        if (!headers[i] || headers[i].trim().toLowerCase() !== expectedHeaders[i].toLowerCase()) {
           headerValid = false;
           break;
        }
      }
      
      if (!headerValid) {
        return res.status(400).json({ status: "error", message: "Format kolom tidak sesuai standar (Nama Judul, Deskripsi, Hasil Diharapkan, Level)" });
      }
      
      connection = await mysqlPool.getConnection();
      
      const newSuiteId = `suite-${Date.now()}`;
      const newSuiteName = `${file.originalname.replace(/\.[^/.]+$/, "")} (${phase})`;
      
      // Create Suite
      await connection.query(
        `INSERT INTO QATestSuites (id, projectId, name, phase, uploadedBy, uploadedAt, fileName)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          newSuiteId,
          projectId,
          newSuiteName,
          phase,
          uploaderName || "Unknown",
          new Date().toISOString(),
          file.originalname
        ]
      );
      
      // Add Cases
      let rowNum = 1;
      const casesToReturn = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i] as any[];
        if (!row || row.length === 0 || !row[0]) continue;
        
        const newCaseId = `case-${Date.now()}-${rowNum}`;
        const newCase = {
          id: newCaseId,
          suiteId: newSuiteId,
          rowNum: rowNum,
          title: row[0],
          steps: row[1] || "",
          expectedResult: row[2] || "",
          status: "Pending",
          priority: row[3] || "Medium",
          commentsList: [],
          evidences: []
        };
        casesToReturn.push(newCase);
        
        await connection.query(
          `INSERT INTO QATestCases (id, projectId, judul, deskripsi, tipeTesting, prioritas, status, steps, history, createdAt, suiteId, rowNum, modulId, commentsList, evidences, expected)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newCase.id,
            projectId,
            newCase.title,
            newCase.steps,
            phase,
            newCase.priority,
            newCase.status,
            JSON.stringify(newCase.steps),
            JSON.stringify([]),
            new Date().toISOString(),
            newSuiteId,
            newCase.rowNum,
            newSuiteId, // Using suiteId as modulId for now
            JSON.stringify([]),
            JSON.stringify([]),
            newCase.expectedResult
          ]
        );
        rowNum++;
      }
      
      res.status(201).json({ 
        status: "success", 
        message: "Bulk upload berhasil",
        data: {
          suiteId: newSuiteId,
          casesCount: casesToReturn.length
        }
      });
    } catch (error: any) {
      console.error("POST /api/v1/qa/test-case/bulk-upload error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  app.post("/api/projects/:projectId/qa-test-suites", verifyProjectAccess(['*']), async (req, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      const suite = req.body;
      connection = await mysqlPool.getConnection();
      await connection.query(
        `INSERT INTO QATestSuites (id, projectId, name, phase, uploadedBy, uploadedAt, fileName, assignedTo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          suite.id,
          projectId,
          suite.name,
          suite.phase,
          suite.uploadedBy,
          suite.uploadedAt || new Date().toISOString(),
          suite.fileName || null,
          suite.assignedTo || null
        ]
      );
      res.json({ status: "success", message: "Test Suite created", data: suite });
    } catch (error: any) {
      console.error("POST /api/projects/:projectId/qa-test-suites error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  app.put("/api/projects/:projectId/qa-test-suites/:id", verifyProjectAccess(['*']), async (req, res) => {
    let connection;
    try {
      const { projectId, id } = req.params;
      const suite = req.body;
      connection = await mysqlPool.getConnection();
      await connection.query(
        `UPDATE QATestSuites SET name = ?, phase = ?, uploadedBy = ?, uploadedAt = ?, fileName = ?, assignedTo = ?
         WHERE id = ? AND projectId = ?`,
        [
          suite.name,
          suite.phase,
          suite.uploadedBy,
          suite.uploadedAt,
          suite.fileName || null,
          suite.assignedTo || null,
          id,
          projectId
        ]
      );
      res.json({ status: "success", message: "Test Suite updated" });
    } catch (error: any) {
      console.error("PUT /api/projects/:projectId/qa-test-suites/:id error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  app.delete("/api/projects/:projectId/qa-test-suites/:id", verifyProjectAccess(['*']), async (req, res) => {
    let connection;
    try {
      const { projectId, id } = req.params;
      connection = await mysqlPool.getConnection();
      // Start transaction
      await connection.beginTransaction();
      
      // Delete test cases under this suite (by suiteId)
      await connection.query(
        "DELETE FROM QATestCases WHERE suiteId = ? AND projectId = ?",
        [id, projectId]
      );
      
      // Delete test cases under this suite (by modulId, for backward compatibility)
      await connection.query(
        "DELETE FROM QATestCases WHERE modulId = ? AND projectId = ?",
        [id, projectId]
      );
      
      // Delete suite
      await connection.query(
        "DELETE FROM QATestSuites WHERE id = ? AND projectId = ?",
        [id, projectId]
      );
      
      await connection.commit();
      res.json({ status: "success", message: "Test Suite and its Test Cases deleted" });
    } catch (error: any) {
      if (connection) await connection.rollback();
      console.error("DELETE /api/projects/:projectId/qa-test-suites/:id error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  // ==========================================
  // QA Test Cases API
  // ==========================================
  app.get("/api/projects/:projectId/qa-test-cases", verifyProjectAccess(['*']), async (req, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      connection = await mysqlPool.getConnection();
      const [rows]: any = await connection.query(
        "SELECT * FROM QATestCases WHERE projectId = ? ORDER BY rowNum ASC, id ASC",
        [projectId]
      );
      
      const safeParse = (str, fallback = []) => {
        if (typeof str !== 'string') return str || fallback;
        try {
          return JSON.parse(str);
        } catch (e) {
          return fallback;
        }
      };

      const parsed = rows.map((row: any) => ({
        ...row,
        steps: safeParse(row.steps, []),
        history: safeParse(row.history, []),
        commentsList: safeParse(row.commentsList, []),
        evidences: safeParse(row.evidences, [])
      }));
      
      res.json({ status: "success", data: parsed });
    } catch (error: any) {
      console.error("GET /api/projects/:projectId/qa-test-cases error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  app.post("/api/projects/:projectId/qa-test-cases", verifyProjectAccess(['*']), async (req, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      const tc = req.body;
      connection = await mysqlPool.getConnection();
      
      await connection.query(
        `INSERT INTO QATestCases (
          id, projectId, judul, deskripsi, tipeTesting, prioritas, caseId, expected, status, steps, history, createdAt, activeTesterId, activeTesterName, lockedAt, modulId,
          suiteId, rowNum, comment, evidenceUrl, evidenceType, evidenceName, linkedBugKey, commentsList, evidences, assignedTo
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tc.id,
          projectId,
          tc.judul || tc.title,
          tc.deskripsi || tc.comment || null,
          tc.tipeTesting || tc.phase || 'SIT',
          tc.prioritas || tc.priority || 'Medium',
          tc.caseId || null,
          tc.expected || tc.expectedResult || null,
          tc.status || 'untested',
          JSON.stringify(tc.steps || []),
          JSON.stringify(tc.history || []),
          tc.createdAt || new Date().toISOString(),
          tc.activeTesterId || null,
          tc.activeTesterName || null,
          tc.lockedAt || null,
          tc.modulId || tc.suiteId || null,
          tc.suiteId || null,
          tc.rowNum || null,
          tc.comment || null,
          tc.evidenceUrl || null,
          tc.evidenceType || null,
          tc.evidenceName || null,
          tc.linkedBugKey || null,
          JSON.stringify(tc.commentsList || []),
          JSON.stringify(tc.evidences || []),
          tc.assignedTo || null
        ]
      );
      
      res.json({ status: "success", message: "Test Case created" });
    } catch (error: any) {
      console.error("POST /api/projects/:projectId/qa-test-cases error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  app.put("/api/projects/:projectId/qa-test-cases/:id", verifyProjectAccess(['*']), async (req, res) => {
    let connection;
    try {
      const { projectId, id } = req.params;
      const tc = req.body;
      connection = await mysqlPool.getConnection();
      
      await connection.query(
        `UPDATE QATestCases SET 
          judul = ?, 
          deskripsi = ?, 
          tipeTesting = ?, 
          prioritas = ?, 
          caseId = ?, 
          expected = ?, 
          status = ?, 
          steps = ?, 
          history = ?,
          activeTesterId = ?,
          activeTesterName = ?,
          lockedAt = ?,
          modulId = ?,
          suiteId = ?,
          rowNum = ?,
          comment = ?,
          evidenceUrl = ?,
          evidenceType = ?,
          evidenceName = ?,
          linkedBugKey = ?,
          commentsList = ?,
          evidences = ?,
          assignedTo = ?
         WHERE id = ? AND projectId = ?`,
        [
          tc.judul || tc.title,
          tc.deskripsi || tc.comment || null,
          tc.tipeTesting || tc.phase || 'SIT',
          tc.prioritas || tc.priority || 'Medium',
          tc.caseId || null,
          tc.expected || tc.expectedResult || null,
          tc.status,
          JSON.stringify(tc.steps || []),
          JSON.stringify(tc.history || []),
          tc.activeTesterId || null,
          tc.activeTesterName || null,
          tc.lockedAt || null,
          tc.modulId || tc.suiteId || null,
          tc.suiteId || null,
          tc.rowNum || null,
          tc.comment || null,
          tc.evidenceUrl || null,
          tc.evidenceType || null,
          tc.evidenceName || null,
          tc.linkedBugKey || null,
          JSON.stringify(tc.commentsList || []),
          JSON.stringify(tc.evidences || []),
          tc.assignedTo || null,
          id,
          projectId
        ]
      );
      
      res.json({ status: "success", message: "Test Case updated" });
    } catch (error: any) {
      console.error("PUT /api/projects/:projectId/qa-test-cases/:id error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  // Dedicated Save endpoint (Form-Data with comment & single file attachment/evidence upload)
  app.post("/api/projects/:projectId/qa-test-cases/:id/save", upload.single('evidence'), verifyProjectAccess(['*']), async (req, res) => {
    let connection;
    try {
      const { projectId, id } = req.params;
      const { comment, commentsList, evidences, status, linkedBugKey, currentUserName } = req.body;
      const file = req.file;

      connection = await mysqlPool.getConnection();

      // Retrieve current test case to update
      const [existingRows]: any = await connection.query(
        "SELECT * FROM QATestCases WHERE id = ? AND projectId = ?",
        [id, projectId]
      );

      if (existingRows.length === 0) {
        return res.status(404).json({ status: "error", message: "Test case tidak ditemukan." });
      }

      const tc = existingRows[0];

      // File handling
      let finalEvidenceUrl = req.body.evidenceUrl !== undefined ? req.body.evidenceUrl : tc.evidenceUrl;
      let finalEvidenceName = req.body.evidenceName !== undefined ? req.body.evidenceName : tc.evidenceName;
      let finalEvidenceType = req.body.evidenceType !== undefined ? req.body.evidenceType : tc.evidenceType;
      
      let finalEvidences = [];
      try {
        finalEvidences = typeof tc.evidences === 'string' ? JSON.parse(tc.evidences) : (tc.evidences || []);
      } catch (e) {
        finalEvidences = [];
      }

      if (file) {
        // Security & Magic Byte Validation
        const fileBuf = fs.readFileSync(file.path);
        const fileVal = validateFileBuffer(fileBuf, file.originalname);
        if (!fileVal.valid) {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          return res.status(400).json({ 
            status: "error", 
            message: fileVal.error || "Gagal Mengunggah Dokumen: Format file tidak didukung atau ukuran melebihi batas maksimum (Max 10MB)." 
          });
        }

        const safeName = fileVal.sanitizedName || sanitizeFilename(file.originalname);
        const newPath = path.join(GLOBAL_UPLOADS_DIR, safeName);
        fs.renameSync(file.path, newPath);

        const relativePath = `/uploads/${safeName}`;
        finalEvidenceUrl = relativePath;
        finalEvidenceName = file.originalname;
        finalEvidenceType = file.mimetype.startsWith("video/") ? "video" : "image";
        
        // Append to list of multiple evidences
        finalEvidences.push({
          id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
          name: file.originalname,
          url: relativePath,
          type: finalEvidenceType
        });
      }

      // If there are other evidences sent as stringified json, parse or combine them
      let parsedEvidences = finalEvidences;
      if (evidences) {
        try {
          parsedEvidences = typeof evidences === 'string' ? JSON.parse(evidences) : evidences;
        } catch (e) {}
      }

      // Comments list handling
      let parsedCommentsList = [];
      try {
        parsedCommentsList = typeof tc.commentsList === 'string' ? JSON.parse(tc.commentsList) : (tc.commentsList || []);
      } catch (e) {
        parsedCommentsList = [];
      }

      if (commentsList) {
        try {
          parsedCommentsList = typeof commentsList === 'string' ? JSON.parse(commentsList) : commentsList;
        } catch (e) {}
      }

      // If a comment is passed, let's append it to commentsList if it's new
      if (comment && comment.trim() && comment !== tc.comment) {
        parsedCommentsList.push({
          id: `comment-${Date.now()}`,
          userName: currentUserName || "Tester LanPro",
          text: comment.trim(),
          timestamp: new Date().toISOString()
        });
      }

      await connection.query(
        `UPDATE QATestCases SET 
          comment = ?,
          commentsList = ?,
          evidenceUrl = ?,
          evidenceName = ?,
          evidenceType = ?,
          evidences = ?,
          status = ?,
          linkedBugKey = ?
         WHERE id = ? AND projectId = ?`,
        [
          comment || tc.comment || null,
          JSON.stringify(parsedCommentsList),
          finalEvidenceUrl,
          finalEvidenceName,
          finalEvidenceType,
          JSON.stringify(parsedEvidences),
          status || tc.status,
          linkedBugKey || tc.linkedBugKey || null,
          id,
          projectId
        ]
      );

      res.json({
        status: "success",
        message: "Test case saved successfully",
        data: {
          id,
          comment: comment || tc.comment,
          commentsList: parsedCommentsList,
          evidenceUrl: finalEvidenceUrl,
          evidenceName: finalEvidenceName,
          evidenceType: finalEvidenceType,
          evidences: parsedEvidences,
          status: status || tc.status,
          linkedBugKey: linkedBugKey || tc.linkedBugKey
        }
      });
    } catch (error: any) {
      console.error("POST /api/projects/:projectId/qa-test-cases/:id/save error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  // Helper Function: Record Non-Destructive Execution Run Log (Audit Trail)
  async function recordExecutionRunLog(
    conn: any,
    projectId: string,
    testCaseId: string,
    executionStatus: string,
    linkedIssueKey: string | null = null,
    userId: string = "system",
    userName: string = "Tester / System",
    notes: string = "",
    evidences: any[] = []
  ) {
    try {
      // 1. Fetch current history from QATestCases
      const [rows]: any = await conn.query(
        "SELECT history FROM QATestCases WHERE id = ? AND projectId = ?",
        [testCaseId, projectId]
      );

      let currentHistory: any[] = [];
      if (rows && rows.length > 0 && rows[0].history) {
        try {
          currentHistory = typeof rows[0].history === "string" ? JSON.parse(rows[0].history) : (rows[0].history || []);
        } catch (e) {
          currentHistory = [];
        }
      }

      const nextRunVersion = currentHistory.length + 1;
      const runLabel = `Run #${nextRunVersion}`;
      const logId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      const newLog = {
        id: logId,
        testCaseId,
        projectId,
        runVersion: nextRunVersion,
        runLabel,
        executionStatus: executionStatus.toUpperCase(),
        linkedIssueKey: linkedIssueKey || null,
        executedByUserId: userId,
        executedByName: userName,
        timestamp,
        notes: notes || `Status eksekusi diubah menjadi ${executionStatus.toUpperCase()}`,
        evidences: evidences || []
      };

      currentHistory.push(newLog);

      // Update QATestCases history JSON
      await conn.query(
        "UPDATE QATestCases SET history = ? WHERE id = ? AND projectId = ?",
        [JSON.stringify(currentHistory), testCaseId, projectId]
      );

      // Insert into QATestCaseExecutionLogs relational table
      try {
        await conn.query(
          `INSERT INTO QATestCaseExecutionLogs 
           (id, testCaseId, projectId, runVersion, runLabel, executionStatus, linkedIssueKey, executedByUserId, executedByName, timestamp, notes, evidences)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            logId,
            testCaseId,
            projectId,
            nextRunVersion,
            runLabel,
            executionStatus.toUpperCase(),
            linkedIssueKey || null,
            userId,
            userName,
            timestamp,
            notes || `Status eksekusi: ${executionStatus.toUpperCase()}`,
            JSON.stringify(evidences || [])
          ]
        );
      } catch (dbErr) {
        // Table fallback
      }

      return newLog;
    } catch (err) {
      console.error("recordExecutionRunLog error:", err);
      return null;
    }
  }

  // GET: Execution History Timeline (Run History Audit Trail)
  app.get("/api/projects/:projectId/qa-test-cases/:id/execution-history", verifyProjectAccess(['*']), async (req, res) => {
    let connection;
    try {
      const { projectId, id } = req.params;
      connection = await mysqlPool.getConnection();
      
      // Try QATestCaseExecutionLogs first
      let logs: any[] = [];
      try {
        const [logRows]: any = await connection.query(
          "SELECT * FROM QATestCaseExecutionLogs WHERE testCaseId = ? AND projectId = ? ORDER BY runVersion ASC",
          [id, projectId]
        );
        if (logRows && logRows.length > 0) {
          logs = logRows.map((r: any) => ({
            ...r,
            evidences: typeof r.evidences === 'string' ? JSON.parse(r.evidences || '[]') : r.evidences
          }));
        }
      } catch (e) {}

      if (logs.length === 0) {
        // Fallback to QATestCases history
        const [tcRows]: any = await connection.query(
          "SELECT history FROM QATestCases WHERE id = ? AND projectId = ?",
          [id, projectId]
        );
        if (tcRows && tcRows.length > 0 && tcRows[0].history) {
          try {
            logs = typeof tcRows[0].history === "string" ? JSON.parse(tcRows[0].history) : tcRows[0].history;
          } catch(e) {}
        }
      }

      res.json({ status: "success", data: logs || [] });
    } catch (error: any) {
      console.error("GET execution-history error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  // Dedicated status update endpoint (Instant with Non-Destructive Execution Run Log)
  app.patch("/api/projects/:projectId/qa-test-cases/:id/status", verifyProjectAccess(['*']), async (req, res) => {
    let connection;
    try {
      const { projectId, id } = req.params;
      const { status, notes } = req.body;
      if (!status) {
        return res.status(400).json({ status: "error", message: "Status required" });
      }

      connection = await mysqlPool.getConnection();
      
      // Get current TC data
      const [tcRows]: any = await connection.query(
        "SELECT * FROM QATestCases WHERE id = ? AND projectId = ?",
        [id, projectId]
      );
      
      let createdBugKey = null;

      if (tcRows.length > 0) {
        const tc = tcRows[0];
        const userIdStr = (req as any).user?.uid || (req as any).user?.id || req.headers['x-user-id'] || 'guest';
        
        // Fetch User Display Name
        let userNameStr = "Tester";
        try {
          const [uRows]: any = await connection.query("SELECT displayName, username FROM Users WHERE id = ? OR uid = ?", [userIdStr, userIdStr]);
          if (uRows && uRows.length > 0) {
            userNameStr = uRows[0].displayName || uRows[0].username || "Tester";
          }
        } catch (e) {}

        // Auto-create Bug if status is Failed and bug hasn't been created yet
        if (status.toLowerCase() === 'failed' && !tc.linkedBugKey) {
          // Generate new Task Key
          const [keyResult]: any = await connection.query(
             "SELECT taskKey FROM Tasks WHERE projectId = ? ORDER BY createdAt DESC LIMIT 1",
             [projectId]
          );
          
          let nextKeyNum = 1;
          let projCode = "PRJ";
          if (keyResult.length > 0 && keyResult[0].taskKey) {
             const keyParts = keyResult[0].taskKey.split('-');
             if (keyParts.length > 1) {
                projCode = keyParts[0];
                nextKeyNum = parseInt(keyParts[1], 10) + 1;
             }
          } else {
             // Try to get prefix from project
             const [projRes]: any = await connection.query("SELECT prefix FROM Projects WHERE id = ?", [projectId]);
             if (projRes.length > 0 && projRes[0].prefix) {
                projCode = projRes[0].prefix;
             }
          }
          const taskKey = `${projCode}-${nextKeyNum}`;
          const bugId = crypto.randomUUID();
          
          const tcTitle = tc.judul || tc.title || "Untitled Test Case";
          const tcDesc = tc.deskripsi || tc.description || "";
          const tcCaseId = tc.caseId || tc.id || "";

          // Requirement 1: Store REPORTER_USER_ID as reporterId on created Bug task
          await connection.query(
            `INSERT INTO Tasks (id, projectId, taskKey, title, description, status, priority, type, reporterId, projectRisk) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [bugId, projectId, taskKey, `Bug: ${tcTitle}`, `Bug otomatis dibuat dari QA Test Case [${tcCaseId}]: ${tcTitle}.\n\n**Deskripsi Test Case:**\n${tcDesc}`, 'To Do', 'High', 'bug', userIdStr, 'High']
          );
          
          createdBugKey = taskKey;
          
          await connection.query(
            "UPDATE QATestCases SET status = ?, linkedBugKey = ? WHERE id = ? AND projectId = ?",
            [status, createdBugKey, id, projectId]
          );
          
          try {
             await createAuditLog(userIdStr as string, projectId, 'CREATE', 'Tasks', bugId, null, { title: `Bug: ${tcTitle}` });
          } catch(e) {}
        } else {
          await connection.query(
            "UPDATE QATestCases SET status = ? WHERE id = ? AND projectId = ?",
            [status, id, projectId]
          );
        }

        // Requirement 3: Record Non-Destructive Execution Run Log (Audit Trail)
        let evList = [];
        try {
          evList = typeof tc.evidences === 'string' ? JSON.parse(tc.evidences) : (tc.evidences || []);
        } catch(e) {}

        const activeLinkedKey = createdBugKey || tc.linkedBugKey || null;
        await recordExecutionRunLog(
          connection,
          projectId,
          id,
          status,
          activeLinkedKey,
          userIdStr,
          userNameStr,
          notes || (createdBugKey ? `Status FAILED. Auto-generated Bug Issue #${createdBugKey}` : `Manual Status Update to ${status.toUpperCase()}`),
          evList
        );
      }

      res.json({ status: "success", message: "Status updated successfully", statusValue: status, bugKey: createdBugKey });
    } catch (error: any) {
      console.error("PATCH /api/projects/:projectId/qa-test-cases/:id/status error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  app.delete("/api/projects/:projectId/qa-test-cases/:id", verifyProjectAccess(['*']), async (req, res) => {
    let connection;
    try {
      const { projectId, id } = req.params;
      connection = await mysqlPool.getConnection();
      await connection.query("DELETE FROM QATestCases WHERE id = ? AND projectId = ?", [id, projectId]);
      res.json({ status: "success", message: "Test Case deleted" });
    } catch (error: any) {
      console.error("DELETE /api/projects/:projectId/qa-test-cases/:id error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  app.post("/api/projects/:projectId/qa-test-cases/sync", verifyProjectAccess(['*']), async (req, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      const testCases = req.body;
      if (!Array.isArray(testCases)) {
        return res.status(400).json({ status: "error", message: "Body must be an array" });
      }
      
      connection = await mysqlPool.getConnection();
      for (const tc of testCases) {
        const [existing]: any = await connection.query(
          "SELECT id FROM QATestCases WHERE id = ?",
          [tc.id]
        );
        
        if (existing && existing.length > 0) {
          await connection.query(
            `UPDATE QATestCases SET 
              judul = ?, 
              deskripsi = ?, 
              tipeTesting = ?, 
              prioritas = ?, 
              caseId = ?, 
              expected = ?, 
              status = ?, 
              steps = ?, 
              history = ?,
              activeTesterId = ?,
              activeTesterName = ?,
              lockedAt = ?,
              modulId = ?,
              suiteId = ?,
              rowNum = ?,
              comment = ?,
              evidenceUrl = ?,
              evidenceType = ?,
              evidenceName = ?,
              linkedBugKey = ?,
              commentsList = ?,
              evidences = ?
             WHERE id = ? AND projectId = ?`,
            [
              tc.judul || tc.title,
              tc.deskripsi || tc.comment || null,
              tc.tipeTesting || tc.phase || 'SIT',
              tc.prioritas || tc.priority || 'Medium',
              tc.caseId || null,
              tc.expected || tc.expectedResult || null,
              tc.status,
              JSON.stringify(tc.steps || []),
              JSON.stringify(tc.history || []),
              tc.activeTesterId || null,
              tc.activeTesterName || null,
              tc.lockedAt || null,
              tc.modulId || tc.suiteId || null,
              tc.suiteId || null,
              tc.rowNum || null,
              tc.comment || null,
              tc.evidenceUrl || null,
              tc.evidenceType || null,
              tc.evidenceName || null,
              tc.linkedBugKey || null,
              JSON.stringify(tc.commentsList || []),
              JSON.stringify(tc.evidences || []),
              tc.id,
              projectId
            ]
          );
        } else {
          await connection.query(
            `INSERT INTO QATestCases (
              id, projectId, judul, deskripsi, tipeTesting, prioritas, caseId, expected, status, steps, history, createdAt, activeTesterId, activeTesterName, lockedAt, modulId,
              suiteId, rowNum, comment, evidenceUrl, evidenceType, evidenceName, linkedBugKey, commentsList, evidences
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              tc.id,
              projectId,
              tc.judul || tc.title,
              tc.deskripsi || tc.comment || null,
              tc.tipeTesting || tc.phase || 'SIT',
              tc.prioritas || tc.priority || 'Medium',
              tc.caseId || null,
              tc.expected || tc.expectedResult || null,
              tc.status || 'untested',
              JSON.stringify(tc.steps || []),
              JSON.stringify(tc.history || []),
              tc.createdAt || new Date().toISOString(),
              tc.activeTesterId || null,
              tc.activeTesterName || null,
              tc.lockedAt || null,
              tc.modulId || tc.suiteId || null,
              tc.suiteId || null,
              tc.rowNum || null,
              tc.comment || null,
              tc.evidenceUrl || null,
              tc.evidenceType || null,
              tc.evidenceName || null,
              tc.linkedBugKey || null,
              JSON.stringify(tc.commentsList || []),
              JSON.stringify(tc.evidences || [])
            ]
          );
        }
      }
      
      res.json({ status: "success", message: `Successfully synced ${testCases.length} test cases` });
    } catch (error: any) {
      console.error("POST /api/projects/:projectId/qa-test-cases/sync error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  // AI-Powered QA Test Case Generator API
  app.post("/api/projects/:projectId/qa-test-cases/generate-ai", verifyProjectAccess(['*']), async (req, res) => {
    try {
      const { judul, deskripsi, tipeTesting, prioritas } = req.body;
      if (!judul) {
        return res.status(400).json({ status: "error", message: "Judul skenario uji diperlukan." });
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

      const response = await generateContentWithFallback(ai, {
        model: "gemini-flash-latest",
        contents: `Anda adalah pakar QA (Quality Assurance) profesional.
Buat skenario uji (test case) QA yang sangat detail dan sistematis berdasarkan informasi tugas berikut:

Nama Fitur/Skenario: ${judul}
Deskripsi/Konteks: ${deskripsi || "Tidak ada deskripsi rinci."}
Tipe Pengujian: ${tipeTesting || "Manual"}
Prioritas: ${prioritas || "Medium"}

Berikan langkah-langkah pengujian (langkah-langkah nyata yang harus dilakukan tester di browser/aplikasi) beserta hasil yang diharapkan (expected result) untuk masing-masing langkah tersebut.`,
        config: {
          temperature: 0.3,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              deskripsi: {
                type: Type.STRING,
                description: "Deskripsi skenario uji yang telah diperbaiki, rapi, dan profesional (dalam Bahasa Indonesia)."
              },
              expected: {
                type: Type.STRING,
                description: "Hasil akhir yang diharapkan secara keseluruhan dari skenario uji ini (dalam Bahasa Indonesia)."
              },
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: "Nomor langkah berurutan (misal '1', '2', '3')" },
                    action: { type: Type.STRING, description: "Tindakan pengujian yang harus dilakukan oleh tester (dalam Bahasa Indonesia)" },
                    expectedResult: { type: Type.STRING, description: "Hasil spesifik yang diharapkan dari tindakan tersebut (dalam Bahasa Indonesia)" }
                  },
                  required: ["id", "action", "expectedResult"]
                },
                description: "Daftar langkah pengujian berurutan."
              }
            },
            required: ["deskripsi", "expected", "steps"]
          }
        }
      });

      const jsonStr = response.text ? response.text.trim() : "{}";
      let parsedData;
      try {
        parsedData = JSON.parse(jsonStr);
      } catch (parseErr) {
        console.error("JSON parse error in QA test generation:", parseErr);
        parsedData = {};
      }

      res.json({
        status: "success",
        data: parsedData
      });
    } catch (error: any) {
      console.error("POST /api/projects/:projectId/qa-test-cases/generate-ai error:", error);
      res.status(500).json({ status: "error", message: error.message || "Gagal membuat skenario uji otomatis dengan AI." });
    }
  });

  // POST /api/v1/projects/:projectId/qa/generate-test-cases-ai
  app.post("/api/v1/projects/:projectId/qa/generate-test-cases-ai", async (req, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      const { suiteName, suitePhase, existingCases } = req.body || {};
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ status: "error", message: "Kunci API Gemini tidak dikonfigurasi pada server." });
      }

      connection = await mysqlPool.getConnection();

      // Parallel queries
      const [meetingsPromise, documentsPromise, tasksPromise] = await Promise.all([
        connection.query("SELECT * FROM Meetings WHERE projectId = ? ORDER BY createdAt DESC", [projectId]),
        connection.query("SELECT * FROM Documents WHERE projectId = ? ORDER BY createdAt DESC", [projectId]),
        connection.query("SELECT * FROM Tasks WHERE projectId = ? AND LOWER(status) NOT IN ('done', 'completed', 'closed') ORDER BY createdAt DESC", [projectId])
      ]);

      const meetingsList = meetingsPromise[0] as any[];
      const documentsList = documentsPromise[0] as any[];
      const tasksList = tasksPromise[0] as any[];

      // Filter meetings from the last 14 days
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const itemsToAggregate: { date: Date; text: string }[] = [];

      meetingsList.forEach((m) => {
        const date = m.createdAt ? new Date(m.createdAt) : new Date();
        if (date >= fourteenDaysAgo) {
          const aiSummaryText = m.aiSummary ? (typeof m.aiSummary === 'string' ? m.aiSummary : JSON.stringify(m.aiSummary)) : '';
          itemsToAggregate.push({
            date,
            text: `[MEETING NOTES]\nTitle: ${m.title || ''}\nDescription: ${m.description || ''}\nTranscript: ${m.transcript || ''}\nSummary: ${aiSummaryText}\nCreated At: ${m.createdAt || ''}\n`
          });
        }
      });

      documentsList.forEach((doc) => {
        const date = doc.createdAt ? new Date(doc.createdAt) : new Date();
        itemsToAggregate.push({
          date,
          text: `[DOCUMENTATION]\nTitle: ${doc.title || ''}\nDescription: ${doc.description || ''}\nType: ${doc.type || ''}\nCreated At: ${doc.createdAt || ''}\n`
        });
      });

      tasksList.forEach((t) => {
        const date = t.createdAt ? new Date(t.createdAt) : new Date();
        itemsToAggregate.push({
          date,
          text: `[ACTIVE TASK]\nKey: ${t.taskKey || ''}\nTitle: ${t.title || ''}\nDescription: ${t.description || ''}\nAcceptance Criteria: ${t.acceptanceCriteria || ''}\nPriority: ${t.priority || ''}\nStatus: ${t.status || ''}\nCreated At: ${t.createdAt || ''}\n`
        });
      });

      // Sort by newest first
      itemsToAggregate.sort((a, b) => b.date.getTime() - a.date.getTime());

      // Limit accumulated prompt context length (approx 80,000 characters to keep context clean and fast)
      let aggregatedPrompt = '';
      const charLimit = 80000;
      for (const item of itemsToAggregate) {
        if ((aggregatedPrompt.length + item.text.length) > charLimit) {
          break; // Stop adding oldest items
        }
        aggregatedPrompt += item.text + "\n";
      }

      if (aggregatedPrompt.trim().length === 0) {
        aggregatedPrompt = "Tidak ada meeting notes 14 hari terakhir, dokumen, atau task aktif untuk project ini.";
      }

      // Build active suite context prompt if provided
      let suiteContextPrompt = "";
      if (suiteName) {
        suiteContextPrompt = `\n\nKonteks Tambahan (Fokus Utama):\nAnda sedang menambahkan skenario pengujian baru untuk test suite aktif bernama "${suiteName}" (Fase: ${suitePhase || 'SIT'}).\n`;
        if (existingCases && existingCases.length > 0) {
          suiteContextPrompt += `Skenario pengujian yang SUDAH ada dalam test suite ini adalah:\n${JSON.stringify(existingCases)}\nHarap fokuskan untuk membuat skenario uji pelengkap yang menguji kasus ekstrem (edge cases) atau alur fungsionalitas lain yang belum tercover di atas, tanpa menduplikasi skenario pengujian yang sudah ada.\n`;
        }
      }

      // Initialize Gemini SDK
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Call Gemini 3.5-flash with Structured Outputs
      const response = await generateContentWithFallback(ai, {
        model: "gemini-flash-latest",
        contents: `Anda adalah Principal QA Engineer dan AI Integration Specialist untuk LanPro.
Berdasarkan data project teragregasi di bawah ini (yang terdiri dari dokumen fungsional, meeting notes terbaru, dan backlog/acceptance criteria aktif), buatlah daftar skenario uji (test cases) yang komprehensif, terstruktur, sistematis, dan siap pakai untuk tim pengujian.
${suiteContextPrompt}
Format keluaran HARUS berupa array JSON yang mematuhi skema berikut secara ketat.

DATA AGREGASI PROJECT:
---
${aggregatedPrompt}
---`,
        config: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            description: "Daftar rekomendasi test case hasil analisis AI",
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Judul skenario pengujian singkat dan spesifik" },
                description: { type: Type.STRING, description: "Deskripsi detail mengenai apa yang diuji dan tujuannya" },
                fase: { type: Type.STRING, description: "Fase testing (SIT, UAT, atau PTR)", enum: ["SIT", "UAT", "PTR"] },
                steps: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Daftar langkah-langkah konkret pengujian yang harus dijalankan" },
                expected_result: { type: Type.STRING, description: "Hasil akhir yang diharapkan secara keseluruhan setelah langkah-langkah di atas dijalankan" },
                priority: { type: Type.STRING, description: "Prioritas pengujian (HIGH, MEDIUM, atau LOW)", enum: ["HIGH", "MEDIUM", "LOW"] }
              },
              required: ["title", "description", "fase", "steps", "expected_result", "priority"]
            }
          }
        }
      });

      const responseText = response.text ? response.text.trim() : "[]";
      let testCases;
      try {
        testCases = JSON.parse(responseText);
      } catch (parseErr) {
        console.error("JSON parse error in test cases generation:", parseErr);
        testCases = [];
      }

      res.json({
        status: "success",
        data: testCases
      });
    } catch (error: any) {
      console.error("POST /api/v1/projects/:projectId/qa/generate-test-cases-ai error:", error);
      res.status(500).json({ status: "error", message: error.message || "Gagal membuat test case dengan AI." });
    } finally {
      if (connection) connection.release();
    }
  });

  // Full System Backup
  app.get("/api/system/backup", verifyGlobalAdmin, async (req, res) => {
    try {
      const connection = await mysqlPool.getConnection();
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

      const connection = await mysqlPool.getConnection();

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
