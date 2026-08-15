export const styles = {
  container: "flex flex-col bg-white dark:bg-slate-900 rounded-md border border-slate-200/80 dark:border-slate-800 shadow-xs font-sans relative flex-1 min-h-[500px] overflow-hidden",
  toolbar: "flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200/80 bg-slate-50/50 dark:bg-slate-800/30 shrink-0",
  searchWrapper: "relative group",
  searchInput: "pl-9 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-medium text-slate-700 dark:text-slate-200 w-full sm:w-64 placeholder:font-normal placeholder:text-slate-400 focus:ring-1 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-2xs",
  filterPill: "px-2.5 py-1 bg-indigo-50/80 dark:bg-indigo-950/20 text-primary dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-900 rounded-md text-[10px] font-medium uppercase tracking-tight shadow-2xs",
  filterPillAmber: "px-2.5 py-1 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900 rounded-md text-[10px] font-medium uppercase tracking-tight shadow-2xs",
  tableWrapper: "overflow-auto w-full custom-scrollbar relative flex-1 min-h-0 max-h-[calc(100vh-220px)]",
  table: "w-full text-left border-collapse flex-none",
  tableHeader: "bg-primary/5 dark:bg-slate-950/50 border-b border-primary/15 sticky top-0 z-10 shadow-2xs",
  tableHeaderCell: "group relative px-4 py-3 text-[11px] font-semibold text-primary dark:text-slate-400 uppercase tracking-wider border-r border-primary/10 dark:border-slate-800",
  tableRow: "group hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-all duration-150 cursor-default border-b border-slate-100 dark:border-slate-800",
  selectedTableRow: "bg-primary/5 dark:bg-primary/20",
  inlineAddRow: "bg-white dark:bg-slate-900 group/inline-add animate-in fade-in slide-in-from-top-1 duration-200 relative overflow-visible",
  inlineAddBorderedCell: "p-0 border-r border-slate-100/50 dark:border-slate-800 relative border-y-2 border-primary",
  inlineAddInput: "w-full bg-transparent border-none text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-0 outline-none",
};

