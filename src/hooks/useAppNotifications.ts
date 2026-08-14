import { useState, useEffect, useRef } from "react";
import { AppNotification } from "../types";
import { apiRequest, getAuthToken, isNetworkOrAuthError } from "../lib/api";

interface UseAppNotificationsProps {
  userId?: string;
  currentUserId?: string;
}

export const useAppNotifications = ({ userId, currentUserId }: UseAppNotificationsProps) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [qaInitialStatusFilter, setQaInitialStatusFilter] = useState<
    "ALL" | "Passed" | "Failed" | "Blocked" | "Retest" | "Pending"
  >("ALL");
  const notificationsRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!getAuthToken()) return;
    if (!userId && !currentUserId) return;
    const effectiveUserId = currentUserId || userId;
    if (!effectiveUserId) return;

    try {
      const data = await apiRequest(`/api/users/${effectiveUserId}/notifications`);
      if (data.status === "success") {
        setNotifications(
          data.data.map((d: any) => ({ ...d, read: d.isRead === 1 || d.read }))
        );
      }
    } catch (error: any) {
      if (isNetworkOrAuthError(error)) {
        console.warn("fetchNotifications: Sesi pengguna atau jaringan tidak tersedia.");
      } else {
        console.error("fetchNotifications error:", error);
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchNotifications();
    }, 500);

    const interval = setInterval(() => {
      fetchNotifications();
    }, 180000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [currentUserId, userId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setIsNotificationsOpen(false);
      }
    }
    if (isNotificationsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isNotificationsOpen]);

  return {
    notifications,
    setNotifications,
    isNotificationsOpen,
    setIsNotificationsOpen,
    qaInitialStatusFilter,
    setQaInitialStatusFilter,
    notificationsRef,
    fetchNotifications,
  };
};
