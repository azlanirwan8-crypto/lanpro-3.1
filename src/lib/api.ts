import { toast } from "sonner";

/**
 * LanPro v1.3 - Centralized API Service with JWT & Conflict Handling
 */


export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function isNetworkOrAuthError(e: any): boolean {
  if (!e) return false;
  const msg = e?.message || String(e);
  if (e?.status === 503 || e?.data?.networkError) return true;
  return (
    msg.includes("Gagal terhubung ke server") ||
    msg.includes("koneksi internet") ||
    msg.includes("Failed to fetch") ||
    msg.includes("fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("Network Request Failed") ||
    msg.includes("Sesi Anda telah berakhir") ||
    msg.includes("Sesi berakhir") ||
    msg.includes("token tidak valid") ||
    msg.includes("Token autentikasi") ||
    msg.includes("Akses ditolak") ||
    msg.includes("429") ||
    msg.includes("Rate exceeded") ||
    msg.includes("rate") ||
    msg.includes("503")
  );
}

export const getAuthToken = () => {
    try {
      return localStorage.getItem("lanpro_jwt_token");
    } catch (e) {
      return null;
    }
};

export const setAuthToken = (token: string) => {
    try {
      localStorage.setItem("lanpro_jwt_token", token);
    } catch (e) {}
};

export const clearAuthToken = () => {
    try {
      localStorage.removeItem("lanpro_jwt_token");
      localStorage.removeItem("sessionUser");
      sessionStorage.removeItem("sessionUser");
      localStorage.removeItem("isAdminMode");
      sessionStorage.removeItem("isAdminMode");
    } catch (e) {}
};

interface FetchOptions extends RequestInit {
    body?: any;
}

export async function apiRequest(url: string, options: FetchOptions = {}, retries = 3, backoff = 1000): Promise<any> {
    const token = getAuthToken();
    const headers = new Headers(options.headers || {});
    
    // Prevent Vercel Edge Caching for all API requests to ensure fresh data
    headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
    headers.set("Pragma", "no-cache");
    
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }
    
    const fetchOptions: RequestInit = {
        ...options,
        headers
    };

    if (options.body && !(options.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
        fetchOptions.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    }
    
    let response: Response;
    try {
        response = await fetch(url, fetchOptions);
    } catch (fetchErr: any) {
        if (retries > 0) {
            console.warn(`Network request failed for ${url} (${fetchErr?.message || 'Failed to fetch'}). Retrying in ${backoff}ms... (${retries} left)`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return apiRequest(url, options, retries - 1, backoff * 1.5);
        }
        throw new ApiError("Gagal terhubung ke server. Silakan periksa koneksi internet Anda.", 503, { networkError: true, rawMessage: fetchErr?.message });
    }
    
    if (response.status === 429 && retries > 0 && !url.includes("/api/auth/")) {
        console.warn(`Rate limited (429) for ${url}. Retrying in ${backoff}ms...`);
        
        // Dispatch centralized rate limit status event for any global listener
        window.dispatchEvent(new CustomEvent("rate_limit_status", {
            detail: { active: true, url, backoff, retriesLeft: retries }
        }));

        toast.warning(`Permintaan terlalu cepat (429). Menghubungi server dalam ${(backoff / 1000).toFixed(1)} detik...`, {
            id: `rate-limit-${url}`,
            duration: backoff + 1000
        });

        await new Promise(resolve => setTimeout(resolve, backoff));
        
        try {
            const retryRes = await apiRequest(url, options, retries - 1, backoff * 2);
            
            // Clean up status on success
            window.dispatchEvent(new CustomEvent("rate_limit_status", {
                detail: { active: false, url }
            }));
            toast.success(`Berhasil terhubung kembali ke server!`, {
                id: `rate-limit-${url}`,
                duration: 2000
            });
            
            return retryRes;
        } catch (err) {
            window.dispatchEvent(new CustomEvent("rate_limit_status", {
                detail: { active: false, url, failed: true }
            }));
            throw err;
        }
    } else if (response.status === 429 && retries === 0) {
        window.dispatchEvent(new CustomEvent("rate_limit_status", {
            detail: { active: false, url, failed: true }
        }));
        toast.error(`Batas percobaan habis. Silakan tunggu beberapa saat lagi.`, {
            id: `rate-limit-${url}`,
            duration: 4000
        });
    } else {
        // Any other non-429 response cleans up active rate-limit status for this URL
        window.dispatchEvent(new CustomEvent("rate_limit_status", {
            detail: { active: false, url }
        }));
    }
    
    // v1.6 Hardening: Safe JSON / Text parsing with fallback & Vercel error sanitization
    let responseData: any = null;

    const contentType = response.headers.get("content-type") || "";
    const isJsonHeader = contentType.includes("application/json");

    try {
        if (isJsonHeader) {
            responseData = await response.json().catch(async () => {
                const text = await response.clone().text().catch(() => "");
                try { return JSON.parse(text); } catch { return text; }
            });
        } else {
            const rawText = await response.text().catch(() => "");
            try {
                responseData = JSON.parse(rawText);
            } catch {
                responseData = rawText;
            }
        }
    } catch (err) {
        responseData = null;
    }

    // v1.4: Enhanced Auth & Session Handling
    // v1.5: Only logout on 401 (Unauthenticated). 403 (Forbidden) should just show the error without clearing token.
    if (response.status === 401) {
        if (!url.includes("/api/auth/")) {
            const message = (responseData && typeof responseData === "object" && responseData.message)
                ? responseData.message
                : "Sesi berakhir. Silakan login kembali.";
            
            clearAuthToken();
            window.dispatchEvent(new Event("auth_expired"));
            throw new ApiError(message, 401, { authError: true });
        }
    }

    if (!response.ok) {
        let message = `Server error: ${response.status}`;
        let errorData: any = {};

        if (responseData && typeof responseData === "object" && !Array.isArray(responseData)) {
            errorData = responseData;
            message = responseData.message || responseData.error || message;
        } else if (typeof responseData === "string" && responseData.trim().length > 0) {
            const text = responseData.trim();
            if (text.includes("<html>") || text.includes("<!DOCTYPE") || text.startsWith("An error") || text.includes("Vercel")) {
                if (response.status === 403) {
                    message = "Akses ditolak. Silakan periksa hak akses Anda.";
                } else if (response.status === 401) {
                    message = "Sesi autentikasi tidak valid.";
                } else if (response.status === 429) {
                    message = "Terlalu banyak permintaan. Silakan tunggu beberapa saat.";
                } else if (response.status >= 500) {
                    message = `Gagal memproses permintaan pada server (${response.status}). Silakan coba beberapa saat lagi.`;
                } else {
                    message = `Terjadi kesalahan pada server (${response.status}).`;
                }
            } else {
                message = text;
            }
        }

        // Sanitize any raw JS syntax error or unhandled Vercel error text
        if (typeof message === "string" && (
            message.includes("Unexpected token") || 
            message.includes("is not valid JSON") || 
            message.startsWith("An error occurred") ||
            message.includes("JSON.parse")
        )) {
            message = `Gagal memproses respons dari server (${response.status}). Silakan coba beberapa saat lagi.`;
        }

        throw new ApiError(message, response.status, errorData);
    }
    
    return responseData;
}
