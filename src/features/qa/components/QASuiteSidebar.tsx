import React from "react";
import { Plus, Edit3, Trash2, FileSpreadsheet, CheckCircle2, User, ChevronDown } from "lucide-react";
import { QATestSuite } from "../types";
import { UserAvatar } from "../../../components/ui/UserAvatar";

interface QASuiteSidebarProps {
  suitesForFilter: QATestSuite[];
  selectedSuiteId: string;
  setSelectedSuiteId: (id: string) => void;
  phaseFilter: "ALL" | "SIT" | "UAT" | "PTR";
  setPhaseFilter: (phase: "ALL" | "SIT" | "UAT" | "PTR") => void;
  setIsAddSuiteOpen: (open: boolean) => void;
  setSuiteToEdit: (suite: QATestSuite) => void;
  setSuiteEditName: (name: string) => void;
  setSuiteEditAssignedTo: (assignedTo: string) => void;
  setSuiteToDelete: (suite: QATestSuite) => void;
  activeSuitePicDropdownId: string | null;
  setActiveSuitePicDropdownId: (id: string | null) => void;
  handleUpdateSuitePic: (suiteId: string, assignedTo: string) => void;
  projectMembers: any[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export const QASuiteSidebar: React.FC<QASuiteSidebarProps> = ({
  suitesForFilter,
  selectedSuiteId,
  setSelectedSuiteId,
  phaseFilter,
  setPhaseFilter,
  setIsAddSuiteOpen,
  setSuiteToEdit,
  setSuiteEditName,
  setSuiteEditAssignedTo,
  setSuiteToDelete,
  activeSuitePicDropdownId,
  setActiveSuitePicDropdownId,
  handleUpdateSuitePic,
  projectMembers,
  canCreate,
  canUpdate,
  canDelete,
}) => {
  return (
    <div className="lg:col-span-3 space-y-3 lg:max-h-[calc(100vh-140px)] lg:sticky lg:top-4 pr-1 custom-scrollbar">
      {/* Velzon Ultra-Compact Card Box */}
      <div className="bg-white border border-slate-200/80 rounded-md p-3.5 shadow-xs space-y-3">
        {/* Header Title */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[#405189]/10 text-[#405189] flex items-center justify-center font-medium">
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-[11px] font-medium text-slate-800 uppercase tracking-wider">
                Daftar Modul Testing
              </h3>
              <p className="text-[9px] text-slate-400 font-medium">Dokumen & Skenario Pengujian</p>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-[#405189]/10 text-[#405189] text-[9px] font-medium rounded-md">
            {suitesForFilter.length} Modul
          </span>
        </div>

        {/* Phase Filter Dropdown & Add Button (Hidden for non-creators) */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value as any)}
              className="w-full py-1.5 px-2.5 bg-slate-50/80 border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#405189]/30 focus:border-[#405189] transition-all cursor-pointer"
            >
              <option value="ALL">Semua Fase (ALL)</option>
              <option value="SIT">Fase SIT (System Integration Test)</option>
              <option value="UAT">Fase UAT (User Acceptance Test)</option>
              <option value="PTR">Fase PTR (Production Readiness Test)</option>
            </select>
          </div>

          {canCreate && (
            <button
              onClick={() => setIsAddSuiteOpen(true)}
              className="px-2.5 py-1.5 bg-[#405189] hover:bg-[#364473] active:bg-[#2d3960] text-white rounded-md shadow-2xs transition-all flex items-center gap-1 text-xs font-medium cursor-pointer shrink-0"
              title="Tambah Modul Testing Baru"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah</span>
            </button>
          )}
        </div>

        {/* Suite Cards List */}
        <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar pb-10">
          {suitesForFilter.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs font-medium">
              Tidak ada dokumen pengujian untuk filter ini.
            </div>
          ) : (
            suitesForFilter.map((suite, sIdx) => {
              const isActive = suite.id === selectedSuiteId;
              const passed = suite.cases?.filter((c) => c.status === "Passed").length || 0;
              const total = suite.cases?.length || 0;
              const percent = total > 0 ? Math.round((passed / total) * 100) : 0;

              const matchedMember = (projectMembers || []).find(
                (m: any) =>
                  m.uid === suite.assignedTo ||
                  m.id === suite.assignedTo ||
                  m.username === suite.assignedTo ||
                  m.email === suite.assignedTo
              );

              const isDropdownOpen = activeSuitePicDropdownId === suite.id;
              const cleanTitle = suite.name.replace(/\s*\((SIT|UAT|PTR)\)/gi, "");

              return (
                <div
                  key={suite.id ? `${suite.id}-${sIdx}` : `suite-${sIdx}`}
                  onClick={() => setSelectedSuiteId(suite.id)}
                  className={`group p-3 rounded-md border transition-all cursor-pointer relative ${
                    isActive
                      ? "bg-white border-[#405189] border-l-4 border-l-[#405189] shadow-sm ring-1 ring-[#405189]/20"
                      : "bg-white border-slate-200/80 hover:border-[#405189]/40 hover:shadow-2xs"
                  }`}
                >
                  {/* Action Buttons Top Right (Visible only to users with edit/delete access) */}
                  {(canUpdate || canDelete) && (
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      {canUpdate && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSuiteToEdit(suite);
                            setSuiteEditName(cleanTitle);
                            setSuiteEditAssignedTo(suite.assignedTo || "");
                          }}
                          className="text-slate-400 hover:text-[#405189] transition-all p-1 bg-slate-50 hover:bg-indigo-50 rounded-md border border-slate-100"
                          title="Ubah Dokumen"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSuiteToDelete(suite);
                          }}
                          className="text-slate-400 hover:text-rose-500 transition-all p-1 bg-slate-50 hover:bg-rose-50 rounded-md border border-slate-100"
                          title="Hapus Dokumen"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Phase Pill Badge */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.2 text-[8px] font-medium uppercase rounded-full tracking-wider ${
                        suite.phase === "SIT"
                          ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                          : suite.phase === "UAT"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          : "bg-purple-50 text-purple-700 border border-purple-200/60"
                      }`}
                    >
                      {suite.phase}
                    </span>
                    <span className="text-[9px] font-medium text-slate-400">
                      {new Date(suite.uploadedAt).toLocaleDateString("id-ID")}
                    </span>
                  </div>

                  {/* Suite Title (Clean without duplicate phase suffix) */}
                  <h4 className="text-xs font-medium text-slate-800 mt-1.5 line-clamp-1 group-hover:text-[#405189] transition-colors pr-10">
                    {cleanTitle}
                  </h4>

                  {/* Velzon Front-Card PIC Assignment Badge */}
                  <div className="mt-2.5 flex items-center justify-between text-[10px] font-medium text-slate-500 pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1 text-slate-400 text-[9px]">
                      <FileSpreadsheet className="w-3 h-3 text-slate-400" />
                      <span className="truncate max-w-[85px]">{suite.fileName || "Custom Script"}</span>
                    </span>

                    {/* Front Card PIC Avatar Button */}
                    <div className="relative">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canUpdate) {
                            setActiveSuitePicDropdownId(isDropdownOpen ? null : suite.id);
                          }
                        }}
                        className={`flex items-center gap-1 px-2 py-0.5 bg-slate-50 rounded-md border border-slate-200/80 transition-all ${
                          canUpdate ? "cursor-pointer hover:bg-indigo-50/80 hover:border-[#405189]/50" : "cursor-default"
                        }`}
                        title={canUpdate ? "Assign / Ubah PIC Modul" : "PIC Modul Terdaftar"}
                      >
                        {suite.assignedTo ? (
                          <>
                            <UserAvatar uid={suite.assignedTo} members={projectMembers} className="w-3.5 h-3.5 rounded-full" />
                            <span className="text-[9px] font-medium text-[#405189] truncate max-w-[80px]">
                              {matchedMember?.displayName?.split(" ")[0] || matchedMember?.username || "PIC"}
                            </span>
                          </>
                        ) : (
                          <div className="flex items-center gap-1 text-[#405189]">
                            <User className="w-2.5 h-2.5" />
                            <span className="text-[8px] font-medium uppercase">All PIC</span>
                          </div>
                        )}
                        {canUpdate && <ChevronDown className="w-2.5 h-2.5 text-slate-400" />}
                      </div>

                      {/* Dropdown Menu - POP UPWARDS (bottom-full) SO IT NEVER GETS CLIPPED */}
                      {isDropdownOpen && canUpdate && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSuitePicDropdownId(null);
                            }}
                          />
                          <div className="absolute right-0 bottom-full mb-1.5 w-56 bg-white rounded-md shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                            <div className="px-3 py-1 text-[9px] font-medium uppercase tracking-wider text-[#405189] border-b border-slate-100 mb-1">
                              Assign PIC Modul (Tim Proyek)
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateSuitePic(suite.id, "");
                              }}
                              className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-indigo-50 hover:text-[#405189] transition-colors flex items-center justify-between ${
                                !suite.assignedTo ? "bg-indigo-50/60 text-[#405189]" : "text-slate-700"
                              }`}
                            >
                              <span>Semua PIC Proyek (All Members)</span>
                              {!suite.assignedTo && <CheckCircle2 className="w-3.5 h-3.5 text-[#405189]" />}
                            </button>
                            <div className="max-h-40 overflow-y-auto custom-scrollbar">
                              {(projectMembers || []).map((m: any) => {
                                const mId = m.uid || m.id;
                                const isSelected = suite.assignedTo === mId;
                                return (
                                  <button
                                    key={mId}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUpdateSuitePic(suite.id, mId);
                                    }}
                                    className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-indigo-50 hover:text-[#405189] transition-colors flex items-center justify-between gap-2 ${
                                      isSelected ? "bg-indigo-50/60 text-[#405189]" : "text-slate-700"
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      <UserAvatar uid={mId} members={projectMembers} className="w-4 h-4 shrink-0" />
                                      <span className="truncate">{m.displayName || m.email || m.username}</span>
                                    </div>
                                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#405189] shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Micro Progress Bar */}
                  <div className="w-full h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-[#405189] transition-all duration-500 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
