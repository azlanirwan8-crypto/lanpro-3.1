/**
 * Tampilan daftar flowchart — kartu, tabel, dan paginasinya.
 *
 * Sebelumnya berupa `renderDashboard()` di dalam FlowchartContainer. JSX-nya
 * dipindah verbatim; yang berubah hanya cara ia memperoleh data — dari closure
 * atas state komponen induk menjadi props eksplisit.
 *
 * Komponen ini sengaja dibuat tanpa state sendiri. Seluruh state paginasi,
 * pencarian, dan daftar tetap tinggal di container, karena kanvas editor juga
 * membacanya. Memindahkannya ke sini akan memecah satu sumber kebenaran
 * menjadi dua.
 */
import React from "react";
import { Workflow, Search, Plus, Eye, Edit3, Trash2 } from "lucide-react";
import { ResponsiveTable } from "../../../components/ResponsiveTable";
import { getInitials } from "../lib/nodeTheme";
import type { FlowchartData } from "../types";
import type { Task } from "../../../types";

interface FlowchartDashboardProps {
  /** Kata kunci pencarian judul dan deskripsi. */
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  /** Paginasi. `setCurrentPage` menerima fungsi pembaru, jadi tipenya Dispatch. */
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
  /** Satu halaman hasil yang sudah tersaring dan terurut. */
  currentItems: FlowchartData[];
  /** Dipakai untuk menampilkan Epic yang tertaut pada tiap flowchart. */
  tasks: Task[];
  openCreateModal: () => void;
  getResolvedAuthor: () => string;
  handleSelectFlowchart: (id: string, listToUse?: FlowchartData[]) => void;
  setIsEditorActive: (value: boolean) => void;
  canModifyFlowchart: (fw: FlowchartData) => boolean;
  handleDeleteFlowchart: (id: string, e: React.MouseEvent) => void;
}

export const FlowchartDashboard: React.FC<FlowchartDashboardProps> = ({
  searchQuery,
  setSearchQuery,
  currentPage,
  setCurrentPage,
  itemsPerPage,
  totalItems,
  totalPages,
  currentItems,
  tasks,
  openCreateModal,
  getResolvedAuthor,
  handleSelectFlowchart,
  setIsEditorActive,
  canModifyFlowchart,
  handleDeleteFlowchart,
}) => {
  return (
      <div className="flex-1 flex flex-col p-3 md:p-6 font-sans overflow-y-auto w-full bg-[#f4f7f9] animate-in fade-in duration-700">
        <div className="flex-1 flex flex-col bg-white border border-slate-200/80 rounded-lg shadow-sm overflow-hidden">
          {/* Dashboard Header matching Meeting Notes */}
          <div className="p-6 md:p-7 border-b border-slate-200/80 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-[#405189]/10 border border-[#405189]/20 rounded-md text-[#405189] shadow-2xs">
                <Workflow className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-medium text-slate-900 tracking-tight">Flowchart Editor</h3>
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  Manage interactive diagrams, process flows, and visual architecture.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <input
                  type="text"
                  placeholder="Search flowcharts by title..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50/60 border border-slate-200/80 rounded-md text-xs placeholder:text-slate-400 outline-none focus:bg-white focus:ring-1 focus:ring-[#405189]/20 focus:border-[#405189] transition-all text-slate-700 font-medium shadow-2xs"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>

              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#405189] hover:bg-[#364473] active:bg-[#2d3960] text-white rounded-md text-xs font-medium transition-all shadow-xs shadow-[#405189]/20 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" /> Add Flowchart
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-white">
            {/* Data Table */}
            <div className="flex-1 overflow-x-auto overflow-y-auto m-6 bg-white rounded-md border border-slate-200/60 shadow-xs">
              <ResponsiveTable className="w-full text-left border-collapse min-w-[880px]">
                <thead>
                  <tr className="bg-[#405189]/5 border-b border-[#405189]/15 text-[11px] font-semibold text-[#405189] uppercase tracking-wider whitespace-nowrap">
                    <th className="py-3.5 px-4 w-14 text-center">No</th>
                    <th className="py-3.5 px-4 min-w-[180px] max-w-[280px]">Flowchart Title</th>
                    <th className="py-3.5 px-4 w-36">Category</th>
                    <th className="py-3.5 px-4 min-w-[180px] max-w-[280px]">Description</th>
                    <th className="py-3.5 px-4 w-44">Linked Epic</th>
                    <th className="py-3.5 px-4 w-40">Author</th>
                    <th className="py-3.5 px-4 w-36">Last Updated</th>
                    <th className="py-3.5 px-4 w-28 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {currentItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-20 text-slate-400">
                        <div className="w-14 h-14 rounded-md bg-[#405189]/10 border border-[#405189]/20 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                          <Workflow className="w-6 h-6 text-[#405189]" />
                        </div>
                        <p className="font-medium text-slate-800 text-sm">No flowcharts found</p>
                        <p className="text-xs text-slate-400 mt-1 mb-4">Create a new flowchart or adjust your search keyword.</p>
                        <button
                          onClick={openCreateModal}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#405189] hover:bg-[#364473] active:bg-[#2d3960] text-white rounded-md text-xs font-medium transition-all shadow-xs shadow-[#405189]/20 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" /> Add Flowchart
                        </button>
                      </td>
                    </tr>
                  ) : (
                    currentItems.map((fw, index) => {
                      const srNo = (currentPage - 1) * itemsPerPage + index + 1;
                      const activeAuthor = getResolvedAuthor();
                      const rawAuthor = fw.createdBy;
                      const createdBy = (!rawAuthor || rawAuthor === "Azlan Irwan") ? activeAuthor : rawAuthor;
                      const formatDateSafe = (dateVal?: string) => {
                        if (!dateVal) return "-";
                        if (dateVal.includes(",") || dateVal.includes("/")) return dateVal;
                        const d = new Date(dateVal);
                        if (isNaN(d.getTime())) return dateVal;
                        return d.toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' });
                      };
                      const lastEditedAt = formatDateSafe(fw.lastEditedAt || fw.createdAt);
                      const initials = getInitials(createdBy);
                      const linkedEpic = tasks.find(t => t.id === fw.epicTaskId);

                      return (
                        <tr
                          key={fw.id}
                          onClick={() => {
                            handleSelectFlowchart(fw.id);
                            setIsEditorActive(true);
                          }}
                          className="hover:bg-slate-50/70 transition-colors duration-200 group cursor-pointer h-14 whitespace-nowrap"
                        >
                          <td className="py-3 px-4 text-center text-slate-400 font-medium whitespace-nowrap">
                            {String(srNo).padStart(2, "0")}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900 group-hover:text-[#405189] transition-colors max-w-[220px] truncate whitespace-nowrap">
                            {fw.name}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-block px-2.5 py-1 bg-indigo-50 text-[#405189] border border-indigo-200/80 text-[10px] font-medium rounded-md uppercase">
                              {fw.category || "Panduan"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-medium max-w-[260px] truncate whitespace-nowrap">
                            {fw.description ? fw.description : <span className="text-slate-300 italic">No description</span>}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {linkedEpic ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 border border-violet-200 text-[10px] font-medium rounded-md max-w-[180px] truncate" title={linkedEpic.title}>
                                🎯 {linkedEpic.title}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-normal text-xs">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#405189]/10 text-[#405189] flex items-center justify-center text-[10px] font-medium shrink-0">
                                {initials}
                              </div>
                              <span className="truncate max-w-[120px]">{createdBy}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-medium whitespace-nowrap">
                            {lastEditedAt}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  handleSelectFlowchart(fw.id);
                                  setIsEditorActive(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-[#405189] hover:bg-[#405189]/10 rounded-md transition-all cursor-pointer"
                                title="View flowchart canvas"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {canModifyFlowchart(fw) && (
                                <>
                                  <button
                                    onClick={() => {
                                      handleSelectFlowchart(fw.id);
                                      setIsEditorActive(true);
                                    }}
                                    className="p-1.5 text-slate-500 hover:text-[#405189] hover:bg-[#405189]/10 rounded-md transition-all cursor-pointer"
                                    title="Edit flowchart"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteFlowchart(fw.id, e)}
                                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                                    title="Delete flowchart"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </ResponsiveTable>
            </div>

            {/* Pagination Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-500 font-medium">
                Showing {totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-md text-xs font-medium disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
                  >
                    Previous
                  </button>
                  <span className="px-3.5 py-1.5 bg-[#405189] text-white rounded-md text-xs font-medium shadow-xs">
                    {currentPage}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-md text-xs font-medium disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
  );
};
