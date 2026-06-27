import type { CSSProperties } from "react";
import Spinner from "./Spinner";

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

// Devam eden (animasyonla vurgulanan) durumlar.
const ACTIVE_STATUSES: DocumentStatus[] = ["uploaded", "processing"];

export default function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status as DocumentStatus] ?? FALLBACK;
  const isActive = ACTIVE_STATUSES.includes(status as DocumentStatus);

  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem",
    padding: "0.15rem 0.6rem",
    borderRadius: 999,
    fontSize: "0.75rem",
    fontWeight: 600,
    background: meta.bg,
    color: meta.color,
    whiteSpace: "nowrap",
    // İşleniyor/yüklendi durumlarında hafif nabız efekti.
    animation: isActive ? "ld-pulse 1.5s ease-in-out infinite" : undefined,
  };

  return (
    <span style={style}>
      {status === "processing" && (
        <Spinner size={11} thickness={2} color={meta.color} />
      )}
      {meta.label}
    </span>
  );
}
