import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const currentFilePath = (typeof import.meta !== 'undefined' && import.meta?.url)
  ? fileURLToPath(import.meta.url)
  : path.join(process.cwd(), 'api', 'index.ts');

const requireFunc = createRequire(currentFilePath);

let serverModule: any = null;
let serverLoadError: any = null;

function getServerModule() {
  if (serverModule) return serverModule;
  if (serverLoadError) throw serverLoadError;
  try {
    // Try multiple possible relative resolution locations on Vercel lambda
    try {
      serverModule = requireFunc("../dist/server.cjs");
    } catch {
      serverModule = requireFunc(path.join(process.cwd(), "dist", "server.cjs"));
    }
    return serverModule;
  } catch (err) {
    serverLoadError = err;
    console.error("[VERCEL] Failed to load server.cjs bundle:", err);
    throw err;
  }
}

export default async function handler(req: any, res: any) {
  // CORS: only echo back the app's own known origin — never wildcard "*" on an
  // API authenticated via Authorization header (wildcard + credentials = any
  // external site can call this API if it obtains a token).
  const allowedOrigin = process.env.APP_URL;
  const requestOrigin = req.headers?.origin;
  if (allowedOrigin && requestOrigin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-user-id");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  console.log(`[VERCEL] Incoming request: ${req.method} ${req.url}`);
  
  try {
    const { app, initializationPromise } = getServerModule();

    if (initializationPromise) {
      try {
        await initializationPromise;
      } catch (err) {
        console.error("[VERCEL] Initialization promise failed:", err);
      }
    }

    return await new Promise((resolve) => {
      app(req, res, (err: any) => {
        if (err) {
          console.error("[VERCEL] App error:", err);
          if (!res.headersSent) {
            res.status(500).json({ status: "error", message: "Server error: " + (err.message || String(err)) });
          }
        }
        resolve(null);
      });
    });
  } catch (err: any) {
    console.error("[VERCEL] Handler execution error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ 
        status: "error", 
        message: "Internal server error: " + (err.message || String(err))
      });
    }
  }
}
