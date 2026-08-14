/**
 * Pengganti `react-markdown` di bawah Jest.
 *
 * react-markdown v10 dan rantai remark/unified-nya hanya diterbitkan sebagai
 * ESM. Jest menjalankan test sebagai CommonJS, jadi `require()` atasnya gagal
 * dengan "Unexpected token 'export'".
 *
 * Stub ini merender teks anaknya apa adanya. Cukup untuk test render: yang
 * diuji adalah komponen kita ter-mount, bukan bahwa markdown ter-parse.
 */
import React from 'react';

export default function ReactMarkdown({ children }: { children?: React.ReactNode }) {
  return <div data-testid="react-markdown">{children}</div>;
}
