// Tasarım sistemi — tüm ekranların paylaştığı "liquid glass" token ve stilleri.
// Blur, .ld-glass / .ld-glass-strong global sınıflarından gelir (bkz. _app.tsx);
// böylece mobilde tek noktadan azaltılabilir.
import type { CSSProperties } from "react";

/** Tek kaynaktan yönetilen tasarım token'ları. */
export const tokens = {
  color: {
    bg: "#05070d", // ana zemin — çok koyu lacivert/siyah
    surface: "rgba(15, 23, 42, 0.6)",
    surfaceStrong: "rgba(9, 14, 26, 0.82)",
    glass: "rgba(17, 25, 44, 0.52)", // yarı saydam cam panel
    glassSoft: "rgba(30, 41, 59, 0.32)",
    glassHover: "rgba(37, 51, 75, 0.55)",
    border: "rgba(148, 163, 184, 0.14)", // ince cam border
    borderStrong: "rgba(148, 163, 184, 0.26)",
    borderGlow: "rgba(96, 165, 250, 0.45)", // ışıklı border vurgusu
    heading: "#f1f5f9",
    text: "#e2e8f0",
    muted: "#94a3b8",
    subtle: "#64748b",
    primary: "#2563eb", // birincil mavi
    primarySoft: "#60a5fa",
    cyan: "#22d3ee", // yardımcı vurgu
    emerald: "#34d399", // başarı
    amber: "#fbbf24", // uyarı
    danger: "#f87171", // hata
  },
  radius: { xs: 4, sm: 6, md: 8, lg: 10 },
  shadow: {
    panel:
      "0 24px 60px rgba(2, 6, 16, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
    soft: "0 12px 32px rgba(2, 6, 16, 0.45)",
    insetHi: "inset 0 1px 0 rgba(255, 255, 255, 0.06)", // üstte cam ışık yansıması
    glowPrimary:
      "0 10px 26px rgba(37, 99, 235, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
  },
  blur: { panel: 18, nav: 16, soft: 10 }, // px — .ld-glass sınıflarıyla senkron
  transition: {
    fast: "0.15s ease",
    base: "0.22s cubic-bezier(0.22, 0.61, 0.36, 1)",
    slow: "0.5s cubic-bezier(0.22, 0.61, 0.36, 1)",
  },
  focusRing: "0 0 0 3px rgba(59, 130, 246, 0.32)",
  space: {
    xs: "0.35rem",
    sm: "0.6rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2.25rem",
    xxl: "3.5rem",
  },
} as const;

const c = tokens.color;
const r = tokens.radius;
const sh = tokens.shadow;

const buttonBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.5rem",
  padding: "0.65rem 1.1rem",
  borderRadius: r.md,
  fontSize: "0.88rem",
  fontWeight: 600,
  textDecoration: "none",
  cursor: "pointer",
  whiteSpace: "nowrap",
  border: "1px solid transparent",
  transition: `background ${tokens.transition.fast}, border-color ${tokens.transition.fast}, box-shadow ${tokens.transition.fast}, transform 0.1s ease, filter ${tokens.transition.fast}, opacity ${tokens.transition.fast}`,
};

/** Reusable liquid glass stil objeleri. */
export const glass: Record<string, CSSProperties> = {
  // --- Kabuk / yerleşim ---
  pageShell: {
    position: "relative",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    color: c.text,
  },
  container: {
    width: "100%",
    maxWidth: 1120,
    margin: "0 auto",
    padding: "0 1.25rem",
  },

  // --- Paneller ---
  glassPanel: {
    background: c.glass,
    border: `1px solid ${c.border}`,
    borderRadius: r.md,
    boxShadow: sh.panel,
  },
  glassPanelStrong: {
    background: c.surfaceStrong,
    border: `1px solid ${c.border}`,
    borderRadius: r.md,
    boxShadow: sh.panel,
  },
  glassPanelSoft: {
    background: c.glassSoft,
    border: `1px solid ${c.border}`,
    borderRadius: r.md,
    boxShadow: sh.insetHi,
  },

  // --- Butonlar ---
  buttonBase,
  glassButton: {
    ...buttonBase,
    background: "linear-gradient(180deg, #2f6bff 0%, #2356e6 100%)",
    color: "#ffffff",
    border: "1px solid rgba(96, 165, 250, 0.6)",
    boxShadow: sh.glowPrimary,
  },
  ghostButton: {
    ...buttonBase,
    background: "rgba(148, 163, 184, 0.06)",
    color: "#dbeafe",
    border: `1px solid ${c.borderStrong}`,
    boxShadow: sh.insetHi,
  },
  dangerButton: {
    ...buttonBase,
    background: "rgba(248, 113, 113, 0.06)",
    color: c.danger,
    border: "1px solid rgba(248, 113, 113, 0.32)",
  },
  smallButton: {
    ...buttonBase,
    padding: "0.38rem 0.75rem",
    fontSize: "0.8rem",
    background: "rgba(148, 163, 184, 0.06)",
    color: "#cbd5e1",
    border: `1px solid ${c.borderStrong}`,
  },
  smallDangerButton: {
    ...buttonBase,
    padding: "0.38rem 0.75rem",
    fontSize: "0.8rem",
    background: "rgba(248, 113, 113, 0.05)",
    color: c.danger,
    border: "1px solid rgba(248, 113, 113, 0.3)",
  },

  // --- Form ---
  label: {
    display: "block",
    marginBottom: "0.4rem",
    fontSize: "0.8rem",
    fontWeight: 600,
    letterSpacing: "0.2px",
    color: "#cbd5e1",
  },
  input: {
    width: "100%",
    padding: "0.68rem 0.85rem",
    background: "rgba(5, 10, 22, 0.55)",
    border: `1px solid ${c.borderStrong}`,
    borderRadius: r.md,
    color: c.text,
    outline: "none",
    boxShadow: sh.insetHi,
  },

  // --- Bildirimler ---
  alertError: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.55rem",
    padding: "0.65rem 0.85rem",
    borderRadius: r.md,
    background: "rgba(248, 113, 113, 0.09)",
    border: "1px solid rgba(248, 113, 113, 0.32)",
    color: "#fecaca",
    fontSize: "0.85rem",
    lineHeight: 1.5,
  },
  alertSuccess: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.55rem",
    padding: "0.65rem 0.85rem",
    borderRadius: r.md,
    background: "rgba(52, 211, 153, 0.08)",
    border: "1px solid rgba(52, 211, 153, 0.3)",
    color: "#bbf7d0",
    fontSize: "0.85rem",
    lineHeight: 1.5,
  },
  alertWarning: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.55rem",
    padding: "0.65rem 0.85rem",
    borderRadius: r.md,
    background: "rgba(251, 191, 36, 0.08)",
    border: "1px solid rgba(251, 191, 36, 0.32)",
    color: "#fde68a",
    fontSize: "0.85rem",
    lineHeight: 1.5,
  },

  // --- Küçük parçalar ---
  kicker: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.45rem",
    padding: "0.32rem 0.7rem",
    borderRadius: r.sm,
    background: "rgba(37, 99, 235, 0.1)",
    border: "1px solid rgba(96, 165, 250, 0.25)",
    color: c.primarySoft,
    fontSize: "0.72rem",
    fontWeight: 700,
    letterSpacing: "0.6px",
    textTransform: "uppercase",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.38rem 0.7rem",
    borderRadius: r.sm,
    background: c.glassSoft,
    border: `1px solid ${c.border}`,
    color: "#cbd5e1",
    fontSize: "0.78rem",
    fontWeight: 600,
    whiteSpace: "nowrap",
    boxShadow: sh.insetHi,
  },
  iconWrap: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: r.md,
    background: "rgba(37, 99, 235, 0.12)",
    border: "1px solid rgba(96, 165, 250, 0.22)",
    color: c.primarySoft,
    boxShadow: sh.insetHi,
    flexShrink: 0,
  },
  sectionTitle: {
    margin: "0 0 0.6rem",
    fontSize: "1.55rem",
    lineHeight: 1.25,
    color: c.heading,
    letterSpacing: "-0.4px",
  },
  sectionLead: {
    margin: 0,
    color: c.muted,
    fontSize: "0.95rem",
    lineHeight: 1.65,
    maxWidth: 620,
  },

  // --- Tablo ---
  tableCell: {
    padding: "0.65rem 0.6rem",
    borderBottom: `1px solid ${c.border}`,
    textAlign: "left",
    verticalAlign: "top",
    fontSize: "0.85rem",
  },
  tableHeadCell: {
    padding: "0.55rem 0.6rem",
    borderBottom: `1px solid ${c.borderStrong}`,
    textAlign: "left",
    verticalAlign: "middle",
    color: c.muted,
    fontWeight: 600,
    fontSize: "0.72rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
  },

  // --- Navigasyon / marka ---
  nav: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: "rgba(5, 8, 16, 0.68)",
    borderBottom: `1px solid ${c.border}`,
  },
  brand: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.55rem",
    textDecoration: "none",
    color: c.heading,
    fontWeight: 700,
    fontSize: "1.02rem",
    letterSpacing: "0.2px",
    whiteSpace: "nowrap",
  },
  brandMark: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 30,
    borderRadius: r.md,
    background:
      "linear-gradient(180deg, rgba(37, 99, 235, 0.38), rgba(34, 211, 238, 0.18))",
    border: `1px solid ${c.borderGlow}`,
    boxShadow: sh.insetHi,
    color: c.primarySoft,
    flexShrink: 0,
  },

  // --- Kartlar ---
  actionCard: {
    display: "flex",
    alignItems: "center",
    gap: "0.85rem",
    padding: "1rem",
    borderRadius: r.md,
    background: c.glass,
    border: `1px solid ${c.border}`,
    boxShadow: sh.insetHi,
    textDecoration: "none",
    color: c.text,
    cursor: "pointer",
  },
  statCard: {
    display: "flex",
    alignItems: "center",
    gap: "0.85rem",
    padding: "1rem 1.1rem",
    borderRadius: r.md,
    background: c.glass,
    border: `1px solid ${c.border}`,
    boxShadow: sh.insetHi,
  },

  // --- Chip (doküman filtresi vb.) ---
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    background: "rgba(148, 163, 184, 0.05)",
    color: "#cbd5e1",
    border: `1px solid ${c.borderStrong}`,
    borderRadius: r.sm,
    padding: "0.34rem 0.7rem",
    cursor: "pointer",
    fontSize: "0.78rem",
    fontWeight: 500,
    maxWidth: 240,
    transition: `background ${tokens.transition.fast}, border-color ${tokens.transition.fast}, color ${tokens.transition.fast}`,
  },
  chipActive: {
    background: "rgba(37, 99, 235, 0.18)",
    color: "#dbeafe",
    border: "1px solid rgba(96, 165, 250, 0.55)",
    boxShadow: sh.insetHi,
  },
};

/**
 * Sayfa düzeyi paylaşılan stiller. Auth sayfaları `page` + `card`,
 * uygulama sayfaları `contentPage` + `contentBody` + `panel` kullanır.
 */
export const ui: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.5rem",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    ...glass.glassPanel,
    padding: "2rem",
  },
  title: {
    margin: "0 0 0.3rem",
    fontSize: "1.45rem",
    color: c.heading,
    letterSpacing: "-0.3px",
  },
  subtitle: {
    margin: "0 0 1.5rem",
    color: c.muted,
    fontSize: "0.9rem",
    lineHeight: 1.55,
  },
  label: glass.label,
  input: { ...glass.input, marginBottom: "1rem" },
  button: { ...glass.glassButton, width: "100%", padding: "0.72rem 1.1rem" },
  buttonDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
    transform: "none",
  },
  error: { ...glass.alertError, marginBottom: "1rem" },
  success: { ...glass.alertSuccess, marginBottom: "1rem" },
  footerText: {
    marginTop: "1.25rem",
    textAlign: "center",
    fontSize: "0.85rem",
    color: c.muted,
  },
  // --- İçerik sayfaları (Header + geniş panel) ---
  contentPage: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  contentBody: {
    flex: 1,
    padding: "1.75rem 1.25rem 2.5rem",
    display: "flex",
    justifyContent: "center",
  },
  panel: {
    width: "100%",
    ...glass.glassPanel,
    padding: "1.75rem",
  },
  pageTitle: {
    margin: 0,
    fontSize: "1.35rem",
    color: c.heading,
    letterSpacing: "-0.3px",
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
  },
  pageSubtitle: {
    margin: "0.35rem 0 0",
    color: c.muted,
    fontSize: "0.87rem",
    lineHeight: 1.55,
  },
};
