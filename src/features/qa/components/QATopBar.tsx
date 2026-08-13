import React from "react";
import { Lock, Unlock, ShieldAlert, FileSpreadsheet } from "lucide-react";

interface QATopBarProps {
  lockState: {
    lockedBy: string | null;
    userName: string | null;
    lockedAt: number | null;
  };
  remainingTime: number;
  currentUserUid: string;
  currentUserRole: string;
  handleForceUnlock: () => void;
  releaseLockManually: () => void;
}

export const QATopBar: React.FC<QATopBarProps> = ({
  lockState,
  remainingTime,
  currentUserUid,
  currentUserRole,
  handleForceUnlock,
  releaseLockManually,
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const isLockedBySomeoneElse = lockState.lockedBy && lockState.lockedBy !== currentUserUid;

  return (
    <div className="page-title-box flex flex-col md:flex-row justify-between items-start md:items-center gap-3.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 rounded-xl shadow-xs">
      
      {/* Velzon Header Title Section */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#405189] text-white flex items-center justify-center font-medium shadow-xs shadow-[#405189]/20 shrink-0">
          <FileSpreadsheet className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            QA Test Cases & Execution Matrix
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Manajemen kasus pengujian dan matriks eksekusi QA
          </p>
        </div>
      </div>

      {/* Velzon Concurrency Lock Panel */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 p-2.5 px-3 rounded-lg w-full md:w-auto shrink-0">
        {lockState.lockedBy ? (
          <>
            {isLockedBySomeoneElse ? (
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="p-2 bg-rose-50 dark:bg-rose-950/30 text-[#f06548] rounded-md">
                  <Lock className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <span className="text-[10px] text-[#f06548] font-bold uppercase tracking-wider block">
                    DILOCK OLEH LAIN
                  </span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mt-0.5">
                    {lockState.userName}
                  </span>
                </div>
                {(currentUserRole === "admin" || currentUserRole === "head" || currentUserRole === "manager") && (
                  <button
                    onClick={handleForceUnlock}
                    className="ml-auto md:ml-2 px-2.5 py-1.5 bg-[#f06548] hover:bg-[#d95338] text-white text-[10px] font-semibold uppercase tracking-wider rounded-md transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Force Unlock
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-[#0ab39c] rounded-md">
                  <Unlock className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#0ab39c] font-bold uppercase tracking-wider">
                      Anda Memegang Lock
                    </span>
                    <span className="px-2 py-0.5 bg-[#405189]/10 text-[#405189] dark:text-indigo-300 text-[10px] font-bold rounded-md">
                      {formatTime(remainingTime)}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400 block mt-0.5">
                    Auto-Unlock dalam 15 mnt inaktivitas
                  </span>
                </div>
                <button
                  onClick={releaseLockManually}
                  className="ml-auto md:ml-2 px-2.5 py-1.5 bg-slate-200/80 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[10px] font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer"
                >
                  Unlock Now
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 px-1 py-0.5">
            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Tidak ada kunci aktif. Membuka test suite akan mengunci otomatis.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

