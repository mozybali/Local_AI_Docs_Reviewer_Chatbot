import type { CSSProperties } from "react";

export type DocumentStatus = "uploaded" | "processing" | "ready" | "error";

interface StatusMeta {
  label: string;
  bg: string;
  color: string;
}

// Doküman yaşam döngüsü durumlarının görsel karşılıkları.
const STATUS_META: Record<DocumentStatus, StatusMeta> = {
  uploaded: { label: "Yüklendi", bg: "#1e293b", color: "#cbd5e1" },
  processing: { label: "İşleniyor", bg: "#78350f", color: "#fde68a" },
  ready: { label: "Hazır", bg: "#14532d", color: "#bbf7d0" },
  error: { label: "Hata", bg: "#7f1d1d", color: "#fecaca" },
};

const FALLBACK: StatusMeta = { label: "Bilinmiyor", bg: "#334155", color: "#e2e8f0" };

export default function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status as DocumentStatus] ?? FALLBACK;

  const style: CSSProperties = {
    display: "inline-block",
    padding: "0.15rem 0.6rem",
    borderRadius: 999,
    fontSize: "0.75rem",
    fontWeight: 600,
    background: meta.bg,
    color: meta.color,
    whiteSpace: "nowrap",
  };

  return <span style={style}>{meta.label}</span>;
}
