/** Ícones Lucide, traço 1.6 — os mesmos do protótipo. */
import type { JSX } from 'react'

const S = (p: { children: JSX.Element | JSX.Element[]; size?: number; w?: number }) => (
  <svg
    width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={p.w ?? 1.6} strokeLinecap="round"
    style={{ display: 'block', flex: 'none' }}
  >
    {p.children}
  </svg>
)

export const Ico = {
  dash: (s?: number) => <S size={s}><><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></></S>,
  novo: (s?: number) => <S size={s}><><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M12 12v6" /><path d="M9 15h6" /></></S>,
  lista: (s?: number) => <S size={s}><><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></></S>,
  itens: (s?: number) => <S size={s}><><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></></S>,
  sep: (s?: number) => <S size={s}><><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12h6" /><path d="M9 16h6" /></></S>,
  cli: (s?: number) => <S size={s}><><path d="M3 21V7l9-4 9 4v14" /><path d="M9 21v-6h6v6" /><path d="M9 10h.01" /><path d="M15 10h.01" /></></S>,
  users: (s?: number) => <S size={s}><><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></></S>,
  rel: (s?: number) => <S size={s}><><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></></S>,
  cor: (s?: number) => <S size={s}><><circle cx="13.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="10.5" r="2.5" /><circle cx="6.5" cy="12.5" r="2.5" /><path d="M12 2a10 10 0 1 0 0 20 2 2 0 0 0 0-4 6 6 0 0 1 0-12 2 2 0 0 0 0-4" /></></S>,
  aces: (s?: number) => <S size={s}><><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.2 2.2M16.9 16.9l2.2 2.2M19.1 4.9l-2.2 2.2M7.1 16.9l-2.2 2.2" /></></S>,
  pdf: (s?: number) => <S size={s}><><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path d="M15 2v5h5" /><path d="M8 13h2.5a1.5 1.5 0 0 1 0 3H8v-3" /><path d="M8 19v-3" /><path d="M14 13v6h1.5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2z" /></></S>,
  inst: (s?: number) => <S size={s}><><path d="M2 18h20" /><path d="M4 18v-3a8 8 0 0 1 16 0v3" /><path d="M10 7V4a2 2 0 0 1 4 0v3" /><path d="M12 7v8" /></></S>,
  kv: (s?: number) => <S size={s}><><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></></S>,
  kit: (s?: number) => <S size={s}><><path d="M16 20V10a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v10" /><rect x="2" y="8" width="20" height="12" rx="1" /><path d="M9 8V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></></S>,
  cfg: (s?: number) => <S size={s}><><path d="M4 21v-7" /><path d="M4 10V3" /><path d="M12 21v-9" /><path d="M12 8V3" /><path d="M20 21v-5" /><path d="M20 12V3" /><path d="M1 14h6" /><path d="M9 8h6" /><path d="M17 16h6" /></></S>,
  sair: (s?: number) => <S size={s}><><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></></S>,
  dup: (s?: number) => <S size={s ?? 13} w={1.5}><><rect x="9" y="9" width="12" height="12" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></></S>,
  del: (s?: number) => <S size={s ?? 13} w={1.5}><><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></></S>,
  del2: (s?: number) => <S size={s ?? 12} w={1.5}><><path d="M3 6h18" /><path d="M19 6l-1 14H6L5 6" /></></S>
}

export type IcoNome = keyof typeof Ico
