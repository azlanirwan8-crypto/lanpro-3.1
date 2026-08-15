/**
 * Panel notifikasi yang muncul dari ikon lonceng di header.
 *
 * Diekstrak dari AppContainer. JSX dipindah apa adanya; yang berubah hanya cara
 * ia memperoleh data — dari closure atas state induk menjadi props eksplisit.
 * Tanpa state sendiri: daftar notifikasi dan status buka-tutupnya tetap tinggal
 * di AppContainer karena header dan penghitung lonceng juga membacanya.
 */
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { Mail } from "lucide-react";
import { RenderIcon } from "./RenderIcon";
import { formatNotification } from "../utils/notificationFormatter";
import type { AppNotification, Task } from "../types";

interface NotificationsDropdownProps {
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
  notifications: AppNotification[];
  currentUser: any;
  user: any;
  /** Menandai satu notifikasi sudah dibaca di backend. */
  markNotificationRead: (userUid: string, notificationId: string) => Promise<any>;
  setCurrentView: (view: any) => void;
  setSelectedTaskForDetail: (task: Task) => void;
  setIsTaskDetailModalOpen: (open: boolean) => void;
  setQaInitialStatusFilter: (filter: any) => void;
  /** Memuat ulang daftar notifikasi setelah salah satunya ditandai terbaca. */
  fetchNotifications: () => void;
  tasks: Task[];
}

export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({
  isNotificationsOpen,
  setIsNotificationsOpen,
  notifications,
  currentUser,
  user,
  markNotificationRead,
  setCurrentView,
  setSelectedTaskForDetail,
  setIsTaskDetailModalOpen,
  setQaInitialStatusFilter,
  fetchNotifications,
  tasks,
}) => {
  return (
    <>
              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="absolute right-0 mt-2 w-80 sm:w-[380px] bg-surface rounded-xl shadow-soft-lg border border-border-subtle z-50 overflow-hidden origin-top-right"
                  >
                  {/* Dropdown Header */}
                  <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between bg-surface">
                    <h3 className="font-medium text-content text-[16px]">
                      Notification
                    </h3>
                    <div className="flex items-center gap-2.5">
                      <span className="bg-violet-100 text-violet-700 text-xs font-medium px-2.5 py-1 rounded-md">
                        {notifications.filter((n) => !n.read).length} New
                      </span>
                      <button
                        className="p-1 text-content-muted hover:text-slate-600 hover:bg-surface-muted rounded-full transition-all"
                        title="Mark all read"
                        onClick={async () => {
                          try {
                            const unread = notifications.filter(
                              (n) => !n.read,
                            );
                            for (const n of unread) {
                              await markNotificationRead(user?.uid || currentUser?.uid, n.id);
                            }
                            fetchNotifications();
                          } catch (e) {}
                        }}
                      >
                        <Mail className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Notification Items List */}
                  <div className="max-h-[380px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-content-muted text-sm italic">
                        Belum ada notifikasi
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {notifications.map((n, index) => {
                          const parsed = formatNotification(n.type, n.title, n.message);
                          
                          const getRelativeTime = (createdAt: any): string => {
                            if (!createdAt) return "-";
                            try {
                              const date = typeof createdAt.toMillis === "function"
                                ? new Date(createdAt.toMillis())
                                : new Date(createdAt);
                              const diffMs = Date.now() - date.getTime();
                              const diffSec = Math.floor(diffMs / 1000);
                              const diffMin = Math.floor(diffSec / 60);
                              const diffHr = Math.floor(diffMin / 60);
                              const diffDay = Math.floor(diffHr / 24);

                              if (diffSec < 60) return "Just now";
                              if (diffMin < 60) return `${diffMin}m ago`;
                              if (diffHr < 24) return `${diffHr}h ago`;
                              if (diffDay === 1) return "1 day ago";
                              if (diffDay < 7) return `${diffDay} days ago`;
                              
                              return format(date, "dd MMM, HH:mm");
                            } catch (e) {
                              return "-";
                            }
                          };

                          const formattedTime = getRelativeTime(n.createdAt);

                          return (
                            <div
                              key={n.id ? `${n.id}-${index}` : `notif-${index}`}
                              onClick={async () => {
                                try {
                                  if (!n.read) {
                                    await markNotificationRead(user?.uid || currentUser?.uid, n.id);
                                    fetchNotifications();
                                  }
                                } catch (e) {
                                  console.error(e);
                                }
                                if (n.type === "bug_retest" || (n.title && n.title.toLowerCase().includes("retest")) || (n.message && n.message.toLowerCase().includes("retest"))) {
                                  setCurrentView("qa");
                                  setQaInitialStatusFilter("Retest");
                                  setIsNotificationsOpen(false);
                                  window.dispatchEvent(new CustomEvent("lanpro_qa_retest_updated", { detail: { taskId: n.relatedId } }));
                                } else if (n.relatedId) {
                                  // if it's a task id
                                  const t = tasks.find(
                                    (x) => x.id === n.relatedId,
                                  );
                                  if (t) {
                                    setSelectedTaskForDetail(t);
                                    setIsTaskDetailModalOpen(true);
                                    setIsNotificationsOpen(false);
                                  }
                                }
                              }}
                              className="py-3.5 px-5 hover:bg-surface-muted transition-all cursor-pointer flex gap-3 items-start relative border-b border-border-subtle last:border-b-0"
                            >
                              {/* Left Icon - Compact & circular */}
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${parsed.iconBgClass || "bg-violet-50 text-violet-600"}`}>
                                {parsed.icon}
                              </div>

                              {/* Content Stack */}
                              <div className="flex-1 min-w-0 pr-4">
                                <h4 className="text-sm font-medium text-content leading-snug break-words">
                                  {parsed.formattedMessage}
                                </h4>
                                <span className="mt-1 block text-xs text-content-muted font-medium">
                                  {formattedTime}
                                </span>
                              </div>

                              {/* Unread indicator dot */}
                              {!n.read && (
                                <div className="absolute right-5 top-5 flex h-2 w-2 shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600 shadow-xs shadow-indigo-300"></span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Dropdown Footer */}
                  <div className="p-4 border-t border-border-subtle bg-surface">
                    <button
                      onClick={() => {
                        setIsNotificationsOpen(false);
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-150 text-center block shadow-xs"
                    >
                      View all notifications
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
    </>
  );
};
