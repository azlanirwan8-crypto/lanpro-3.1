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
        <div className="flex-1 flex flex-col bg-surface border border-border-subtle/80 rounded-lg shadow-sm overflow-hidden">
          {/* Dashboard Header matching Meeting Notes */}
          <div className="p-6 md:p-7 border-b border-border-subtle/80 bg-surface flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-md text-primary shadow-2xs">
                <Workflow className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-medium text-content tracking-tight">Flowchart Editor</h3>
                <p className="text-xs font-medium text-content-muted mt-0.5">
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
                  className="w-full pl-9 pr-4 py-2 bg-surface-sunken/60 border border-border-subtle/80 rounded-md text-xs placeholder:text-content-subtle outline-none focus:bg-surface focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all text-content-body font-medium shadow-2xs"
                />
                <Search className="w-3.5 h-3.5 text-content-subtle absolute left-3 top-1/2 -translate-y-1/2" />
              </div>

              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover active:bg-primary-active text-white rounded-md text-xs font-medium transition-all shadow-xs shadow-primary/20 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" /> Add Flowchart
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-surface">
            {/* Data Table */}
            <div className="flex-1 overflow-x-auto overflow-y-auto m-6 bg-surface rounded-md border border-border-subtle/60 shadow-xs">
              <ResponsiveTable className="w-full text-left border-collapse min-w-[880px]">
                <thead>
                  <tr className="bg-primary/5 border-b border-primary/15 text-[11px] font-semibold text-primary uppercase tracking-wider whitespace-nowrap">
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
                <tbody className="divide-y divide-border-faint text-xs font-medium text-content-body">
                  {currentItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-20 text-content-subtle">
                        <div className="w-14 h-14 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                          <Workflow className="w-6 h-6 text-primary" />
                        </div>
                        <p className="font-medium text-content-strong text-sm">No flowcharts found</p>
                        <p className="text-xs text-content-subtle mt-1 mb-4">Create a new flowchart or adjust your search keyword.</p>
                        <button
                          onClick={openCreateModal}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover active:bg-primary-active text-white rounded-md text-xs font-medium transition-all shadow-xs shadow-primary/20 cursor-pointer"
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
                          className="hover:bg-surface-sunken/70 transition-colors duration-200 group cursor-pointer h-14 whitespace-nowrap"
                        >
                          <td className="py-3 px-4 text-center text-content-subtle font-medium whitespace-nowrap">
                            {String(srNo).padStart(2, "0")}
                          </td>
                          <td className="py-3 px-4 font-medium text-content group-hover:text-primary transition-colors max-w-[220px] truncate whitespace-nowrap">
                            {fw.name}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-block px-2.5 py-1 bg-indigo-50 text-primary border border-indigo-200/80 text-[10px] font-medium rounded-md uppercase">
                              {fw.category || "Panduan"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-content-muted font-medium max-w-[260px] truncate whitespace-nowrap">
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
                          <td className="py-3 px-4 text-content-body font-medium whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium shrink-0">
                                {initials}
                              </div>
                              <span className="truncate max-w-[120px]">{createdBy}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-content-muted font-medium whitespace-nowrap">
                            {lastEditedAt}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  handleSelectFlowchart(fw.id);
                                  setIsEditorActive(true);
                                }}
                                className="p-1.5 text-content-muted hover:text-primary hover:bg-primary/10 rounded-md transition-all cursor-pointer"
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
                                    className="p-1.5 text-content-muted hover:text-primary hover:bg-primary/10 rounded-md transition-all cursor-pointer"
                                    title="Edit flowchart"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteFlowchart(fw.id, e)}
                                    className="p-1.5 text-content-muted hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
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
            <div className="px-6 py-4 border-t border-border-subtle bg-surface-sunken/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-content-muted font-medium">
                Showing {totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 bg-surface border border-border-subtle text-content-secondary hover:bg-surface-sunken rounded-md text-xs font-medium disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
                  >
                    Previous
                  </button>
                  <span className="px-3.5 py-1.5 bg-primary text-white rounded-md text-xs font-medium shadow-xs">
                    {currentPage}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 bg-surface border border-border-subtle text-content-secondary hover:bg-surface-sunken rounded-md text-xs font-medium disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
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
