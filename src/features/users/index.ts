/**
 * Barrel users.
 *
 * Hanya re-export. Implementasinya ada di AdminUserPanel.tsx — sebelumnya seluruhnya
 * ditulis di index.tsx, sehingga `import { AdminUserPanel } from './features/users'`
 * menarik ribuan baris lewat berkas yang namanya tidak menyebut apa pun.
 */
export { AdminUserPanel } from './AdminUserPanel';
