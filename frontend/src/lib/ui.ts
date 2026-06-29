// Sayfalar arasında paylaşılan basit inline stil tanımları.
import type { CSSProperties } from "react";

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
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 12,
    padding: "2rem",
    boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
  },
  title: {
    margin: "0 0 0.25rem",
    fontSize: "1.5rem",
  },
  subtitle: {
    margin: "0 0 1.5rem",
    color: "#94a3b8",
    fontSize: "0.9rem",
  },
  label: {
    display: "block",
    marginBottom: "0.35rem",
    fontSize: "0.85rem",
    color: "#cbd5e1",
  },
  input: {
    width: "100%",
    padding: "0.65rem 0.75rem",
    marginBottom: "1rem",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 8,
    color: "#e2e8f0",
    outline: "none",
  },
  button: {
    width: "100%",
    padding: "0.7rem",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  error: {
    background: "#7f1d1d",
    color: "#fecaca",
    padding: "0.6rem 0.75rem",
    borderRadius: 8,
    marginBottom: "1rem",
    fontSize: "0.85rem",
  },
  success: {
    background: "#14532d",
    color: "#bbf7d0",
    padding: "0.6rem 0.75rem",
    borderRadius: 8,
    marginBottom: "1rem",
    fontSize: "0.85rem",
  },
  footerText: {
    marginTop: "1.25rem",
    textAlign: "center",
    fontSize: "0.85rem",
    color: "#94a3b8",
  },
  // --- İçerik sayfaları (Header + geniş panel) için paylaşılan düzen ---
  contentPage: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  contentBody: {
    flex: 1,
    padding: "1.5rem 1.25rem",
    display: "flex",
    justifyContent: "center",
  },
  panel: {
    width: "100%",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 12,
    padding: "2rem",
    boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
  },
};

/**
 * Landing (/) sayfası için paylaşılan tasarım token'ları.
 * Renk, radius, spacing ve shadow değerleri tek kaynaktan yönetilir;
 * "Liquid Glass" estetiği için yarı saydam paneller ve ince ışıklı border'lar.
 */
export const tokens = {
  color: {
    bg: "#060912", // ana arka plan — çok koyu lacivert/siyah
    panel: "rgba(19, 28, 47, 0.55)", // yarı saydam koyu slate cam panel
    panelSoft: "rgba(30, 41, 59, 0.35)",
    panelStrong: "rgba(13, 20, 36, 0.72)",
    border: "rgba(148, 163, 184, 0.14)", // ince, düşük kontrastlı border
    borderStrong: "rgba(148, 163, 184, 0.24)",
    borderGlow: "rgba(96, 165, 250, 0.45)", // hafif ışıklı border vurgusu
    heading: "#f1f5f9",
    text: "#e2e8f0",
    muted: "#94a3b8",
    subtle: "#64748b",
    accent: "#2563eb", // birincil vurgu — mavi
    accentSoft: "#60a5fa",
    cyan: "#22d3ee", // yardımcı vurgu
    green: "#34d399",
    warning: "#fbbf24",
    danger: "#f87171",
  },
  radius: { sm: 6, md: 8 }, // maks. ~8px — bubble UI'dan kaçın
  shadow: {
    panel: "0 18px 44px rgba(3, 7, 18, 0.55)",
    soft: "0 10px 30px rgba(3, 7, 18, 0.45)",
    insetHi: "inset 0 1px 0 rgba(255, 255, 255, 0.06)", // üstte yumuşak ışık yansıması
  },
} as const;

const c = tokens.color;

export const landing: Record<string, CSSProperties> = {
  shell: {
    position: "relative",
    minHeight: "100vh",
    overflow: "hidden",
    color: c.text,
    // Katmanlı derinlik: mavi + cyan yumuşak ışık halkaları, koyu zemin üstünde.
    background:
      "radial-gradient(1100px 620px at 80% -10%, rgba(37,99,235,0.20), transparent 60%)," +
      "radial-gradient(900px 540px at 4% 8%, rgba(34,211,238,0.10), transparent 55%)," +
      `linear-gradient(180deg, ${c.bg} 0%, #05070f 100%)`,
  },
  container: {
    width: "100%",
    maxWidth: 1080,
    margin: "0 auto",
    padding: "0 1.25rem",
  },
  nav: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: "rgba(6, 9, 18, 0.65)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    borderBottom: `1px solid ${c.border}`,
  },
  brand: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.55rem",
    textDecoration: "none",
    color: c.heading,
    fontWeight: 700,
    fontSize: "1.05rem",
    letterSpacing: "0.2px",
  },
  brandMark: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 30,
    borderRadius: tokens.radius.md,
    background: "linear-gradient(180deg, rgba(37,99,235,0.35), rgba(34,211,238,0.18))",
    border: `1px solid ${c.borderGlow}`,
    boxShadow: tokens.shadow.insetHi,
    color: c.accentSoft,
  },
  glassPanel: {
    background: c.panel,
    border: `1px solid ${c.border}`,
    borderRadius: tokens.radius.md,
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    boxShadow: `${tokens.shadow.panel}, ${tokens.shadow.insetHi}`,
  },
  alert: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    padding: "0.7rem 0.9rem",
    borderRadius: tokens.radius.md,
    background: "rgba(251, 191, 36, 0.08)",
    border: "1px solid rgba(251, 191, 36, 0.32)",
    color: "#fde68a",
    fontSize: "0.85rem",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.4rem 0.7rem",
    borderRadius: tokens.radius.sm,
    background: c.panelSoft,
    border: `1px solid ${c.border}`,
    color: "#cbd5e1",
    fontSize: "0.78rem",
    fontWeight: 600,
    whiteSpace: "nowrap",
    boxShadow: tokens.shadow.insetHi,
  },
  kicker: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.45rem",
    padding: "0.32rem 0.7rem",
    borderRadius: tokens.radius.sm,
    background: "rgba(37, 99, 235, 0.10)",
    border: "1px solid rgba(96, 165, 250, 0.25)",
    color: c.accentSoft,
    fontSize: "0.72rem",
    fontWeight: 700,
    letterSpacing: "0.6px",
    textTransform: "uppercase",
  },
  sectionTitle: {
    margin: "0 0 0.6rem",
    fontSize: "1.6rem",
    lineHeight: 1.25,
    color: c.heading,
    letterSpacing: "-0.4px",
  },
  sectionLead: {
    margin: 0,
    color: c.muted,
    fontSize: "0.95rem",
    lineHeight: 1.6,
    maxWidth: 620,
  },
  btnBase: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    padding: "0.72rem 1.2rem",
    borderRadius: tokens.radius.md,
    fontSize: "0.9rem",
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
    border: "1px solid transparent",
    transition:
      "background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease, filter 0.15s ease",
  },
  btnPrimary: {
    background: "linear-gradient(180deg, #2f6bff 0%, #2356e6 100%)",
    color: "#ffffff",
    border: "1px solid rgba(96, 165, 250, 0.6)",
    boxShadow:
      "0 10px 24px rgba(37, 99, 235, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
  },
  btnSecondary: {
    background: "rgba(148, 163, 184, 0.06)",
    color: "#dbeafe",
    border: `1px solid ${c.borderStrong}`,
    boxShadow: tokens.shadow.insetHi,
  },
  btnDanger: {
    background: "rgba(248, 113, 113, 0.06)",
    color: c.danger,
    border: "1px solid rgba(248, 113, 113, 0.32)",
  },
  iconWrap: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 42,
    height: 42,
    borderRadius: tokens.radius.md,
    background: "rgba(37, 99, 235, 0.12)",
    border: "1px solid rgba(96, 165, 250, 0.22)",
    color: c.accentSoft,
    boxShadow: tokens.shadow.insetHi,
    flexShrink: 0,
  },
  actionCard: {
    display: "flex",
    alignItems: "center",
    gap: "0.85rem",
    padding: "1rem",
    borderRadius: tokens.radius.md,
    background: c.panel,
    border: `1px solid ${c.border}`,
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    boxShadow: tokens.shadow.insetHi,
    textDecoration: "none",
    color: c.text,
    cursor: "pointer",
    transition:
      "border-color 0.15s ease, background 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease",
  },
};
