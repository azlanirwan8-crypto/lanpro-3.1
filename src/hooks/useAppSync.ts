import { useState, useEffect } from "react";

export const useAppSync = () => {
  const [socketConnected, setSocketConnected] = useState(false);
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [latencyStatus, setLatencyStatus] = useState<
    "excellent" | "warning" | "poor" | "offline"
  >("excellent");
  const [isSyncing, setIsSyncing] = useState(false);
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>("Baru saja");

  const checkLatency = async () => {
    const startTime = performance.now();
    try {
      const response = await fetch("/api/health-check", {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const duration = Math.round(performance.now() - startTime);

      if (response.ok) {
        setApiLatency(duration);
        if (duration < 150) {
          setLatencyStatus("excellent");
        } else if (duration < 500) {
          setLatencyStatus("warning");
        } else {
          setLatencyStatus("poor");
        }
      } else {
        setApiLatency(null);
        setLatencyStatus("offline");
      }
    } catch (e) {
      setApiLatency(null);
      setLatencyStatus("offline");
    }
  };

  useEffect(() => {
    setApiLatency(12);
    setLatencyStatus("excellent");
  }, []);

  return {
    socketConnected,
    setSocketConnected,
    apiLatency,
    setApiLatency,
    latencyStatus,
    setLatencyStatus,
    isSyncing,
    setIsSyncing,
    cacheStats,
    setCacheStats,
    lastSyncedTime,
    setLastSyncedTime,
    checkLatency,
  };
};
