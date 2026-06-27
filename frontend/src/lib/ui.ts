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
