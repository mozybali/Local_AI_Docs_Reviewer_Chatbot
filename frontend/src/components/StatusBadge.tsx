import type { CSSProperties } from "react";
import { tokens as t } from "../lib/ui";
import Spinner from "./Spinner";

export type DocumentStatus = "uploaded" | "processing" | "ready" | "error";

interface StatusMeta {
  label: string;
  bg: string;
  border: string;
  color: string;
  dot: string;
}

// Doküman yaşam döngüsü durumlarının görsel karşılıkları (glass tinted).
const STATUS_META: Record<DocumentStatus, StatusMeta> = {
  uploaded: {
    label: "Yüklendi",
    bg: "rgba(148, 163, 184, 0.08)",
    border: "rgba(148, 163, 184, 0.28)",
    color: "#cbd5e1",
    dot: "#94a3b8",
  },
  processing: {
    label: "İşleniyor",
    bg: "rgba(251, 191, 36, 0.08)",
    border: "rgba(251, 191, 36, 0.3)",
    color: "#fde68a",
    dot: t.color.amber,
  },
  ready: {
    label: "Hazır",
    bg: "rgba(52, 211, 153, 0.08)",
    border: "rgba(52, 211, 153, 0.3)",
    color: "#bbf7d0",
    dot: t.color.emerald,
  },
  error: {
    label: "Hata",
    bg: "rgba(248, 113, 113, 0.08)",
    border: "rgba(248, 113, 113, 0.32)",
    color: "#fecaca",
    dot: t.color.danger,
  },
};

const FALLBACK: StatusMeta = {
  label: "Bilinmiyor",
  bg: "rgba(148, 163, 184, 0.08)",
  border: "rgba(148, 163, 184, 0.28)",
  color: "#e2e8f0",
  dot: "#94a3b8",
};

// Devam eden (animasyonla vurgulanan) durumlar.
const ACTIVE_STATUSES: DocumentStatus[] = ["uploaded", "processing"];

export default function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status as DocumentStatus] ?? FALLBACK;
  const isActive = ACTIVE_STATUSES.includes(status as DocumentStatus);

  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem",
    padding: "0.18rem 0.55rem",
    borderRadius: t.radius.sm,
    fontSize: "0.73rem",
    fontWeight: 600,
    background: meta.bg,
    border: `1px solid ${meta.border}`,
    color: meta.color,
    whiteSpace: "nowrap",
    boxShadow: t.shadow.insetHi,
    // İşleniyor/yüklendi durumlarında hafif nabız efekti.
    animation: isActive ? "ld-pulse-soft 1.6s ease-in-out infinite" : undefined,
  };

  return (
    <span style={style}>
      {status === "processing" ? (
        <Spinner size={11} thickness={2} color={meta.color} />
      ) : (
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: meta.dot,
            flexShrink: 0,
          }}
        />
      )}
      {meta.label}
    </span>
  );
}
