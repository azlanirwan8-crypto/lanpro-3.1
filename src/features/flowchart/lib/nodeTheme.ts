/**
 * Pemetaan node → kelas Tailwind.
 *
 * Data masuk, string kelas keluar. Tidak ada state, ref, maupun DOM — karena
 * itu tempatnya di lib/ menurut aturan lapisan ARCHITECTURE.md §2, bukan di
 * dalam komponen tempatnya semula tinggal.
 *
 * Pelengkap `lib/shapes.tsx`: berkas itu menggambar bentuk yang butuh SVG
 * presisi, berkas ini memberi gaya bentuk yang cukup diwakili sebuah div.
 */
import type { FlowNode } from '../types';
import { colorPalettes } from '../constants';
import { customSvgTypes } from './shapes';

/**
 * Menghasilkan kelas Tailwind untuk sebuah node sesuai tipe, warna, gaya
 * garis, dan status terpilihnya.
 *
 * Bentuk yang digambar sebagai SVG (lihat `customSvgTypes`) sengaja dibuat
 * transparan tanpa border: rangkanya digambar SVG di belakangnya, sehingga
 * border div akan tampak sebagai kotak ganda.
 */
export const getShapeThemeClasses = (node: FlowNode, isSelected: boolean): string => {
  const palette = colorPalettes[node.color] || colorPalettes.indigo;
  const ringClass = isSelected ? "ring-4 ring-offset-2 ring-violet-500 z-30" : "";

  let base = "transition-all duration-300 flex flex-col justify-center items-center text-center p-3 select-none";
  let borderStyleClass = "border-2";
  if (node.borderStyle === "dashed") borderStyleClass = "border-2 border-dashed";
  if (node.borderStyle === "none") borderStyleClass = "border-0 shadow-none";

  if (customSvgTypes.includes(node.type as any) || node.type === "parallelogram" || node.type === "diamond" || node.type === "decision") {
    const customIsSelectedRing = isSelected ? "z-30" : "";
    return `transition-all duration-300 flex flex-col justify-center items-center text-center p-3 select-none ${palette.text} ${customIsSelectedRing} relative bg-transparent border-0`;
  }

  if (node.type === "sticky") {
    return `${base} justify-start text-left p-4 bg-yellow-150 ${palette.bg} ${palette.text} border-b-[3px] border-black/15 rounded-md ${ringClass}`;
  }

  if (node.type === "rect") {
    return `${base} ${borderStyleClass} rounded-xl ${palette.bg} ${palette.text} ${ringClass}`;
  }

  // Tidak ada cabang untuk "oval" dan "circle": keduanya terdaftar di
  // `customSvgTypes`, sehingga pemeriksaan di atas sudah menanganinya lebih
  // dulu. Cabang khusus untuk keduanya pernah ada di sini dan tidak pernah
  // sekali pun tercapai. Menambahkannya kembali tidak akan berpengaruh —
  // yang perlu diubah adalah daftar di lib/shapes.tsx.

  if (node.type === "cylinder" || node.type === "database") {
    return `${base} ${borderStyleClass} rounded-t-[20px] rounded-b-[20px] ${palette.bg} ${palette.text} ${ringClass}`;
  }

  if (node.type === "cloud") {
    return `${base} ${borderStyleClass} rounded-[28px] ${palette.bg} ${palette.text} ${ringClass}`;
  }

  if (node.type === "card") {
    return `${base} border border-slate-200/80 rounded-xl text-left items-start p-4 bg-white/95 backdrop-blur-sm shadow-sm ${palette.text} ${ringClass}`;
  }

  if (node.type === "document") {
    return `${base} ${borderStyleClass} rounded-tl-lg rounded-tr-2xl rounded-b-lg ${palette.bg} ${palette.text} ${ringClass}`;
  }

  if (node.type === "subprocess" || node.type === "predefined") {
    return `${base} ${borderStyleClass} rounded-lg ${palette.bg} ${palette.text} ${ringClass}`;
  }

  if (node.type === "actor") {
    return `${base} ${borderStyleClass} rounded-full aspect-square ${palette.bg} ${palette.text} ${ringClass}`;
  }

  if (node.type === "folder") {
    return `${base} ${borderStyleClass} rounded-b-lg rounded-tr-lg ${palette.bg} ${palette.text} ${ringClass}`;
  }

  return `${base} ${palette.text} border-0 bg-transparent text-left items-start ${ringClass}`;
};

/**
 * Inisial dua huruf untuk avatar penulis flowchart.
 *
 * "LP" (LanPro) dipakai bila nama tidak diketahui.
 */
export const getInitials = (name?: string): string => {
  if (!name) return "LP";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};
