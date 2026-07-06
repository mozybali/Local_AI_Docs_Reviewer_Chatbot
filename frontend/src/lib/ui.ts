// Tasarım sistemi — tüm ekranların paylaştığı token ve stiller.
// Renk değerleri _app.tsx'te tanımlanan CSS değişkenlerinden (--ld-*) gelir;
// aydınlık/karanlık tema :root[data-theme] üzerinden tek noktadan değişir.
// Blur, .ld-glass / .ld-glass-strong global sınıflarından gelir (bkz. _app.tsx).
import type { CSSProperties } from "react";

/** Tek kaynaktan yönetilen tasarım token'ları. */
export const tokens = {
  color: {
    bg: "var(--ld-bg)",
    surface: "var(--ld-surface)",
    surfaceStrong: "var(--ld-surface)",
    glass: "var(--ld-surface)", // ana yüzey / kart
    glassSoft: "var(--ld-surface-2)", // ikincil yüzey
    glassHover: "var(--ld-surface-2)",
    border: "var(--ld-border)", // ince border
    borderStrong: "var(--ld-border-strong)",
    borderGlow: "var(--ld-primary-border)", // vurgulu border
    heading: "var(--ld-text)",
    text: "var(--ld-text)",
    muted: "var(--ld-text-muted)",
    subtle: "var(--ld-text-muted)",
    primary: "var(--ld-primary)", // primary / CTA
    primaryHover: "var(--ld-primary-hover)",
    primarySoft: "var(--ld-primary)",
    onPrimary: "var(--ld-on-primary)", // primary zemin üzerindeki metin
    // Sohbet yüzeyleri
    userBubble: "var(--ld-user-bubble)",
    userBubbleText: "var(--ld-user-bubble-text)",
    userBubbleBorder: "var(--ld-user-bubble-border)",
    assistantBubble: "var(--ld-assistant-bubble)",
    codeBg: "var(--ld-code-bg)",
    // Durum renkleri (palet dışı; her temada okunur tonlar _app.tsx'te)
    cyan: "var(--ld-info)", // yardımcı vurgu / bilgi
    emerald: "var(--ld-success)", // başarı
    amber: "var(--ld-warning)", // uyarı
    danger: "var(--ld-danger)", // hata
  },
  radius: { xs: 4, sm: 6, md: 8, lg: 10 },
  shadow: {
    panel: "var(--ld-shadow-panel)",
    soft: "var(--ld-shadow-soft)",
    insetHi: "var(--ld-shadow-inset)", // üstte ince ışık yansıması
    glowPrimary: "var(--ld-shadow-primary)",
  },
  blur: { panel: 18, nav: 16, soft: 10 }, // px — .ld-glass sınıflarıyla senkron
  transition: {
    fast: "0.15s ease",
    base: "0.22s cubic-bezier(0.22, 0.61, 0.36, 1)",
    slow: "0.5s cubic-bezier(0.22, 0.61, 0.36, 1)",
  },
  focusRing: "var(--ld-focus-shadow)",
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

/** Reusable stil objeleri. */
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
    background: c.surface,
    border: `1px solid ${c.border}`,
    borderRadius: r.md,
    boxShadow: sh.panel,
  },
  glassPanelStrong: {
    background: c.surface,
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
    background: c.primary,
    color: c.onPrimary,
    border: "1px solid transparent",
    boxShadow: sh.glowPrimary,
  },
  ghostButton: {
    ...buttonBase,
    background: c.surface,
    color: c.text,
    border: `1px solid ${c.borderStrong}`,
    boxShadow: sh.insetHi,
  },
  dangerButton: {
    ...buttonBase,
    background: "var(--ld-danger-bg)",
    color: c.danger,
    border: "1px solid var(--ld-danger-border)",
  },
  smallButton: {
    ...buttonBase,
    padding: "0.38rem 0.75rem",
    fontSize: "0.8rem",
    background: c.surface,
    color: c.text,
    border: `1px solid ${c.borderStrong}`,
  },
  smallDangerButton: {
    ...buttonBase,
    padding: "0.38rem 0.75rem",
    fontSize: "0.8rem",
    background: "var(--ld-danger-bg)",
    color: c.danger,
    border: "1px solid var(--ld-danger-border)",
  },

  // --- Form ---
  label: {
    display: "block",
    marginBottom: "0.4rem",
    fontSize: "0.8rem",
    fontWeight: 600,
    letterSpacing: "0.2px",
    color: c.muted,
  },
  input: {
    width: "100%",
    padding: "0.68rem 0.85rem",
    background: c.surface,
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
    background: "var(--ld-danger-bg)",
    border: "1px solid var(--ld-danger-border)",
    color: c.danger,
    fontSize: "0.85rem",
    lineHeight: 1.5,
  },
  alertSuccess: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.55rem",
    padding: "0.65rem 0.85rem",
    borderRadius: r.md,
    background: "var(--ld-success-bg)",
    border: "1px solid var(--ld-success-border)",
    color: c.emerald,
    fontSize: "0.85rem",
    lineHeight: 1.5,
  },
  alertWarning: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.55rem",
    padding: "0.65rem 0.85rem",
    borderRadius: r.md,
    background: "var(--ld-warning-bg)",
    border: "1px solid var(--ld-warning-border)",
    color: c.amber,
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
    background: "var(--ld-primary-tint)",
    border: "1px solid var(--ld-primary-border)",
    color: c.primary,
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
    color: c.muted,
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
    background: "var(--ld-primary-tint)",
    border: "1px solid var(--ld-primary-border)",
    color: c.primary,
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
    background: "var(--ld-nav-bg)",
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
    background: c.primary,
    border: "1px solid var(--ld-primary-border)",
    boxShadow: sh.insetHi,
    color: c.onPrimary,
    flexShrink: 0,
  },

  // --- Kartlar ---
  actionCard: {
    display: "flex",
    alignItems: "center",
    gap: "0.85rem",
    padding: "1rem",
    borderRadius: r.md,
    background: c.surface,
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
    background: c.surface,
    border: `1px solid ${c.border}`,
    boxShadow: sh.insetHi,
  },

  // --- Chip (doküman filtresi vb.) ---
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    background: c.glassSoft,
    color: c.muted,
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
    background: "var(--ld-primary-tint-strong)",
    color: c.primary,
    border: "1px solid var(--ld-primary-border)",
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
