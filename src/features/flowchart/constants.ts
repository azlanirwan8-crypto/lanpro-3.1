/**
 * Konstanta Flowchart.
 *
 * Diekstrak apa adanya dari FlowchartContainer.tsx (Fase 3 — Anti-God-Object).
 */

/** Palet HEX untuk bentuk SVG presisi (Tailwind-equivalent). */
export const colorPaletteHex: Record<string, { bg: string; bgGrad: string; stroke: string }> = {
  yellow: { bg: "#fffbeb", bgGrad: "#fef3c7", stroke: "#eab308" }, // amber-50 / amber-100 / amber-500
  orange: { bg: "#fff7ed", bgGrad: "#ffedd5", stroke: "#f97316" }, // orange-50 / orange-100 / orange-500
  pink: { bg: "#fdf2f8", bgGrad: "#fce7f3", stroke: "#ec4899" },   // pink-50 / pink-100 / pink-500
  blue: { bg: "#eff6ff", bgGrad: "#dbeafe", stroke: "#3b82f6" },   // blue-50 / blue-100 / blue-550
  green: { bg: "#ecfdf5", bgGrad: "#d1fae5", stroke: "#10b981" },  // emerald-50 / emerald-100 / emerald-500
  purple: { bg: "#faf5ff", bgGrad: "#f3e8ff", stroke: "#a855f7" }, // purple-50 / purple-100 / purple-500
  indigo: { bg: "#eef2ff", bgGrad: "#e0e7ff", stroke: "#6366f1" }, // indigo-50 / indigo-100 / indigo-500
  sky: { bg: "#f0f9ff", bgGrad: "#e0f2fe", stroke: "#0ea5e9" },    // sky-50 / sky-100 / sky-500
  amber: { bg: "#fffbeb", bgGrad: "#fef3c7", stroke: "#f59e0b" },  // amber-50 / amber-100 / amber-550
  rose: { bg: "#fff1f2", bgGrad: "#ffe4e6", stroke: "#f43f5e" },   // rose-50 / rose-100 / rose-500
  violet: { bg: "#f5f3ff", bgGrad: "#ede9fe", stroke: "#8b5cf6" }, // violet-50 / violet-100 / violet-500
  slate: { bg: "#f8fafc", bgGrad: "#f1f5f9", stroke: "#64748b" }   // slate-50 / slate-100 / slate-500
};
