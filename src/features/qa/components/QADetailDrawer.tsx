import React from "react";
import {
  XCircle, FileSpreadsheet, History, RefreshCw, Paperclip,
  Trash2, Send, Bug
} from "lucide-react";
import { QATestCase } from "../types";

interface QADetailDrawerProps {
  selectedTestCase: QATestCase | null;
  setSelectedTestCase: (tc: QATestCase | null) => void;
  drawerActiveTab: "details" | "history";
  setDrawerActiveTab: (tab: "details" | "history") => void;
  executionLogs: any[];
  loadingHistory: boolean;
  fetchExecutionHistory: (caseId: string) => void;
  drawerNewComment: string;
  setDrawerNewComment: (comment: string) => void;
  handleSendCommentFromDrawer: (e?: React.FormEvent) => void;
  handleEvidenceUploadFromDrawer: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveSpecificEvidenceFromDrawer: (evidenceId: string) => void;
  handleOpenCreateBugModal: (tc: QATestCase) => void;
  handleStatusChange: (caseId: string, newStatus: "Passed" | "Failed" | "Blocked" | "Retest" | "Pending") => void;
  projectMembers: any[];
}

export const QADetailDrawer: React.FC<QADetailDrawerProps> = ({
  selectedTestCase,
  setSelectedTestCase,
  drawerActiveTab,
  setDrawerActiveTab,
  executionLogs,
  loadingHistory,
  fetchExecutionHistory,
  drawerNewComment,
  setDrawerNewComment,
  handleSendCommentFromDrawer,
  handleEvidenceUploadFromDrawer,
  handleRemoveSpecificEvidenceFromDrawer,
  handleOpenCreateBugModal,
  handleStatusChange,
  projectMembers,
}) => {
  if (!selectedTestCase) return null;

  return (
    /* BACKDROP OVERLAY WITH AUTO-CLOSE ON CLICK OUTSIDE */
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex justify-end cursor-pointer animate-in fade-in duration-150"
      onClick={() => setSelectedTestCase(null)}
    >
      {/* INNER DRAWER CONTAINER (PREVENT CLICK PROPAGATION & COMPACT SLIM VELZON LOOK) */}
      <div
        className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200 border-l border-slate-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Velzon Offcanvas Header - COMPACT INTEGRATED HEADER & STATUS */}
        <div className="p-4 border-b border-slate-100 bg-[#405189]/5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#405189] text-white font-medium text-[10px] rounded-md">
                TC #{selectedTestCase.rowNum}
              </span>
              <span
                className={`px-2 py-0.5 text-[9px] font-medium uppercase rounded-md ${
                  selectedTestCase.priority === "Critical" || selectedTestCase.priority === "High"
                    ? "bg-rose-50 text-[#f06548] border border-rose-200/60"
                    : "bg-slate-100 text-slate-700 border border-slate-200/60"
                }`}
              >
                {selectedTestCase.priority || "Medium"} Priority
              </span>
            </div>

            {/* STATUS UPDATE SELECTOR INTEGRATED DIRECTLY IN TOP HEADER */}
            <div className="flex items-center gap-2">
              <select
                value={selectedTestCase.status}
                onChange={(e) => {
                  const val = e.target.value as any;
                  handleStatusChange(selectedTestCase.id, val);
                  setSelectedTestCase({ ...selectedTestCase, status: val });
                }}
                className={`py-1 px-2.5 rounded-md text-[11px] font-medium uppercase tracking-wider outline-none cursor-pointer border shadow-2xs ${
                  selectedTestCase.status === "Passed"
                    ? "bg-emerald-50 text-[#0ab39c] border-emerald-200"
                    : selectedTestCase.status === "Failed"
                    ? "bg-rose-50 text-[#f06548] border-rose-200"
                    : selectedTestCase.status === "Blocked"
                    ? "bg-amber-50 text-[#f7b84b] border-amber-200"
                    : selectedTestCase.status === "Retest"
                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                <option value="Passed">Passed</option>
                <option value="Failed">Failed</option>
                <option value="Blocked">Blocked</option>
                <option value="Retest">Retest</option>
                <option value="Pending">Pending</option>
              </select>

              <button
                onClick={() => setSelectedTestCase(null)}
                className="p-1 rounded-md hover:bg-slate-200/80 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Tutup (Atau klik di luar panel)"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>

          <h3 className="text-sm font-medium text-slate-800 line-clamp-2 leading-snug">
            {selectedTestCase.title}
          </h3>
        </div>

        {/* Velzon Compact Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-100/80 p-1 gap-1">
          <button
            type="button"
            onClick={() => setDrawerActiveTab("details")}
            className={`flex-1 py-1.5 text-[10px] font-medium uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              drawerActiveTab === "details"
                ? "bg-white text-[#405189] shadow-2xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Detail Case
          </button>
          <button
            type="button"
            onClick={() => {
              setDrawerActiveTab("history");
              fetchExecutionHistory(selectedTestCase.id);
            }}
            className={`flex-1 py-1.5 text-[10px] font-medium uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              drawerActiveTab === "history"
                ? "bg-white text-[#405189] shadow-2xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Execution History
            {executionLogs.length > 0 && (
              <span className="bg-[#405189]/10 text-[#405189] text-[9px] px-1.5 py-0.2 rounded-full font-medium">
                {executionLogs.length}
              </span>
            )}
          </button>
        </div>

        {/* Sleek Body Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {drawerActiveTab === "history" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[10px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-[#405189]" />
                    Execution History Timeline
                  </h4>
                  <p className="text-[10px] text-slate-400">Audit Trail historis eksekusi pengujian</p>
                </div>
                <button
                  onClick={() => fetchExecutionHistory(selectedTestCase.id)}
                  className="p-1 text-slate-400 hover:text-[#405189] rounded-md hover:bg-slate-100 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
                </button>
              </div>

              {loadingHistory ? (
                <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#405189]" />
                  Memuat riwayat eksekusi...
                </div>
              ) : executionLogs.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 border border-slate-100 rounded-md p-3">
                  <History className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                  <p className="text-xs font-medium text-slate-600">Belum Ada Catatan Run Eksekusi</p>
                </div>
              ) : (
                <div className="relative pl-3.5 border-l-2 border-[#405189]/20 space-y-3 my-2">
                  {executionLogs.map((log: any, idx: number) => {
                    const st = (log.executionStatus || log.status || "PENDING").toUpperCase();
                    return (
                      <div key={log.id ? `run-log-${log.id}-${idx}` : `run-log-${idx}`} className="relative group">
                        <div
                          className={`absolute -left-[19px] top-1.5 w-2.5 h-2.5 rounded-full border-2 ${
                            st === "PASSED"
                              ? "border-[#0ab39c] bg-[#0ab39c]"
                              : st === "FAILED"
                              ? "border-[#f06548] bg-[#f06548]"
                              : "border-slate-400 bg-slate-400"
                          }`}
                        />
                        <div className="bg-slate-50 p-2.5 rounded-md border border-slate-100 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-800">
                              {log.executedByName || "Tester"}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(log.executedAt || log.timestamp || Date.now()).toLocaleString("id-ID")}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 text-[9px] font-medium rounded ${
                              st === "PASSED"
                                ? "bg-emerald-100 text-[#0ab39c]"
                                : st === "FAILED"
                                ? "bg-rose-100 text-[#f06548]"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {st}
                          </span>
                          {log.evaluationNotes && (
                            <p className="text-xs text-slate-600 bg-white p-2 rounded-md border border-slate-100">
                              {log.evaluationNotes}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Steps Box */}
              <div>
                <h4 className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                  Langkah-Langkah Pengujian (Steps)
                </h4>
                <div className="bg-slate-50 p-3 rounded-md border border-slate-200/60 text-xs font-medium text-slate-700 whitespace-pre-line leading-relaxed">
                  {selectedTestCase.steps}
                </div>
              </div>

              {/* Expected Result Box */}
              <div>
                <h4 className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                  Hasil yang Diharapkan (Expected Result)
                </h4>
                <div className="bg-emerald-50/40 p-3 rounded-md border border-emerald-100 text-xs font-medium text-[#0ab39c] leading-relaxed">
                  {selectedTestCase.expectedResult}
                </div>
              </div>

              {/* Evidence Screenshots */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    Bukti Pengujian ({selectedTestCase.evidences?.length || 0})
                  </h4>
                  <label className="px-2.5 py-1 bg-[#405189]/10 hover:bg-[#405189]/20 text-[#405189] text-[10px] font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    <span>Upload Evidence</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={handleEvidenceUploadFromDrawer}
                      className="hidden"
                    />
                  </label>
                </div>

                {selectedTestCase.evidences && selectedTestCase.evidences.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedTestCase.evidences.map((ev) => (
                      <div key={ev.id} className="relative group border border-slate-200 rounded-md overflow-hidden">
                        {ev.type === "video" ? (
                          <video src={ev.url} controls className="w-full h-24 object-cover" />
                        ) : (
                          <img src={ev.url} alt={ev.name} className="w-full h-24 object-cover" />
                        )}
                        <button
                          onClick={() => handleRemoveSpecificEvidenceFromDrawer(ev.id)}
                          className="absolute top-1 right-1 p-1 bg-[#f06548] text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Hapus Bukti"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Belum ada bukti pengujian.</p>
                )}
              </div>

              {/* Comments */}
              <div>
                <h4 className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                  Komentar QA ({selectedTestCase.commentsList?.length || 0})
                </h4>
                <div className="space-y-2 mb-2.5">
                  {(selectedTestCase.commentsList || []).map((cm, cIdx) => (
                    <div key={cm.id || cIdx} className="bg-slate-50 p-2.5 rounded-md border border-slate-200/60 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-800">{cm.userName}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(cm.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{cm.text}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendCommentFromDrawer} className="flex gap-2">
                  <input
                    type="text"
                    value={drawerNewComment}
                    onChange={(e) => setDrawerNewComment(e.target.value)}
                    placeholder="Tulis komentar pengujian..."
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium outline-none focus:border-[#405189]"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-[#405189] hover:bg-[#354473] text-white rounded-md transition-colors cursor-pointer shadow-2xs"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>

              {/* Failed Bug Ticket Action */}
              {selectedTestCase.status === "Failed" && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenCreateBugModal(selectedTestCase)}
                    className="w-full py-2 bg-[#f06548] hover:bg-[#d95338] text-white font-medium rounded-md text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
                  >
                    <Bug className="w-4 h-4" />
                    <span>Buat Tiket Bug dari Test Case Ini</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
