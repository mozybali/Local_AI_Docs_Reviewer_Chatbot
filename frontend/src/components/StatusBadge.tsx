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

// Doküman yaşam döngüsü durumlarının görsel karşılıkları (tema değişkenleri).
const STATUS_META: Record<DocumentStatus, StatusMeta> = {
  uploaded: {
    label: "Yüklendi",
    bg: "var(--ld-surface-2)",
    border: "var(--ld-border-strong)",
    color: t.color.muted,
    dot: t.color.muted,
  },
  processing: {
    label: "İşleniyor",
    bg: "var(--ld-warning-bg)",
    border: "var(--ld-warning-border)",
    color: t.color.amber,
    dot: t.color.amber,
  },
  ready: {
    label: "Hazır",
    bg: "var(--ld-success-bg)",
    border: "var(--ld-success-border)",
    color: t.color.emerald,
    dot: t.color.emerald,
  },
  error: {
    label: "Hata",
    bg: "var(--ld-danger-bg)",
    border: "var(--ld-danger-border)",
    color: t.color.danger,
    dot: t.color.danger,
  },
};

const FALLBACK: StatusMeta = {
  label: "Bilinmiyor",
  bg: "var(--ld-surface-2)",
  border: "var(--ld-border-strong)",
  color: t.color.muted,
  dot: t.color.muted,
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
