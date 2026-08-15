import { safeLocalStorage } from "../lib/safeStorage";
/**
 * LanPro - Client-Side Cache Helper (SWR Caching System)
 * Stores local state snapshot to localStorage for instantaneous loading (Stale-While-Revalidate).
 */

export const CacheManager = {
  save: (key: string, data: any) => {
    try {
      const payload = {
        timestamp: Date.now(),
        data,
      };
      safeLocalStorage.setItem(`lanpro_cache_${key}`, JSON.stringify(payload));
    } catch (e) {
      console.warn("Failed to save to client-side cache:", e);
    }
  },

  get: <T>(key: string): T | null => {
    try {
      const cached = safeLocalStorage.getItem(`lanpro_cache_${key}`);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      return parsed.data as T;
    } catch (e) {
      console.warn("Failed to read from client-side cache:", e);
      return null;
    }
  },

  getWithMeta: (key: string) => {
    try {
      const cached = safeLocalStorage.getItem(`lanpro_cache_${key}`);
      if (!cached) return null;
      return JSON.parse(cached);
    } catch (e) {
      return null;
    }
  },

  clear: (key: string) => {
    try {
      safeLocalStorage.removeItem(`lanpro_cache_${key}`);
    } catch (e) {}
  },

  clearAll: () => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((k) => {
        if (k.startsWith("lanpro_cache_")) {
          safeLocalStorage.removeItem(k);
        }
      });
    } catch (e) {
      console.error("Failed to clear all cache:", e);
    }
  },

  getStats: () => {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter((k) => k.startsWith("lanpro_cache_"));
      let totalSize = 0;
      const details: { key: string; size: string; count: number; lastUpdated?: string }[] = [];

      cacheKeys.forEach((k) => {
        const val = safeLocalStorage.getItem(k) || "";
        const bytes = val.length * 2; // UTF-16 characters are 2 bytes
        totalSize += bytes;

        let count = 0;
        let lastUpdated = undefined;
        try {
          const parsed = JSON.parse(val);
          if (parsed.timestamp) {
            lastUpdated = new Date(parsed.timestamp).toLocaleTimeString();
          }
          if (Array.isArray(parsed.data)) {
            count = parsed.data.length;
          } else if (parsed.data && typeof parsed.data === "object") {
            count = Object.keys(parsed.data).length;
          } else if (parsed.data) {
            count = 1;
          }
        } catch (_) {}

        details.push({
          key: k.replace("lanpro_cache_", ""),
          size: (bytes / 1024).toFixed(2) + " KB",
          count,
          lastUpdated,
        });
      });

      return {
        totalSizeKB: (totalSize / 1024).toFixed(2) + " KB",
        itemsCount: cacheKeys.length,
        details,
      };
    } catch (e) {
      return {
        totalSizeKB: "0.00 KB",
        itemsCount: 0,
        details: [],
      };
    }
  },
};
