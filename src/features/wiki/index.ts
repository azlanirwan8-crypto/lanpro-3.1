/**
 * Barrel wiki.
 *
 * Hanya re-export. Implementasinya ada di WikiView.tsx — sebelumnya seluruhnya
 * ditulis di index.tsx, sehingga `import { WikiView } from './features/wiki'`
 * menarik ribuan baris lewat berkas yang namanya tidak menyebut apa pun.
 */
export { WikiView } from './WikiView';
