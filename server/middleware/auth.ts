import jwt from "jsonwebtoken";
import { Response, NextFunction } from "express";
import db from "../../src/lib/db";

export interface UserSession {
  token: string;
  ip: string;
  browser: string;
  device: string;
  lastActiveAt: number;
  browserSessionId?: string;
}

export const activeUserSessions = new Map<string, UserSession>();

export const getJwtSecret = (): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error("[SECURITY] JWT_SECRET tidak ditemukan di environment.");
  }
  return process.env.JWT_SECRET;
};

export const generateToken = (user: any): string => {
  return jwt.sign(
    {
      id: user.id,
      uid: user.uid,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
    },
    getJwtSecret(),
    { expiresIn: "2h" }
  );
};

export const verifyGlobalAdmin = (req: any, res: Response, next: NextFunction) => {
  if (req.user?.role === "admin") {
    next();
  } else {
    res
      .status(403)
      .json({ status: "error", message: "Akses ditolak: Hanya Global Admin yang memiliki izin." });
  }
};

export const authenticateJWT = (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers?.authorization;

  if (!authHeader) {
    return res.status(401).json({
      status: "error",
      message: "Akses ditolak: Token autentikasi tidak ditemukan.",
    });
  }

  if (authHeader.startsWith("Bearer ")) {
    const parts = authHeader.split(" ");
    const token = parts.length === 2 ? parts[1] : null;

    if (!token) {
      return res.status(401).json({
        status: "error",
        message: "Format token tidak valid.",
      });
    }

    jwt.verify(token, getJwtSecret(), (err: any, user: any) => {
      if (err) {
        return res.status(401).json({
          status: "error",
          message: "Sesi Anda telah berakhir atau token tidak valid. Silakan login kembali.",
        });
      }

      // Single login concurrent session check (Database-backed for Serverless & Multi-instance compatibility - NO BYPASS)
      const userId = user.id || user.uid;

      if (userId) {
        db.query("SELECT currentSessionToken FROM Users WHERE id = ?", [userId.toString()])
          .then(([rows]: any) => {
            if (rows && rows.length > 0) {
              const currentToken = rows[0].currentSessionToken;
              if (currentToken && currentToken !== token) {
                return res.status(401).json({
                  status: "error",
                  message:
                    "Sesi Anda telah diakhiri karena akun Anda telah masuk di perangkat/browser lain.",
                });
              }
            }
            req.user = user;
            next();
          })
          .catch((dbErr: any) => {
            console.error(
              "[AUTH MIDDLEWARE] Gagal memverifikasi token sesi dari database, fallback ke in-memory check:",
              dbErr
            );
            // Fallback to in-memory activeUserSessions if DB fails
            const activeSession = activeUserSessions.get(userId.toString());
            if (activeSession && activeSession.token !== token) {
              return res.status(401).json({
                status: "error",
                message:
                  "Sesi Anda telah diakhiri karena akun Anda telah masuk di perangkat/browser lain.",
              });
            }
            req.user = user;
            next();
          });
      } else {
        req.user = user;
        next();
      }
    });
  } else {
    res.status(401).json({
      status: "error",
      message: "Akses ditolak: Format Authorization bukan Bearer.",
    });
  }
};
