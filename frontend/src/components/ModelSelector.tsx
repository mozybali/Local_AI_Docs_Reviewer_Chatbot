import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Cpu, RefreshCw } from "lucide-react";
import { apiFetch, getErrorMessage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { glass as g, tokens as t } from "../lib/ui";

// GET /chat/models yanıtı: üretim parametreleri (context window vb.) backend
// tarafından bilinçli olarak DÖNMEZ; kullanıcı yalnızca model kimliği seçer.
export interface ModelOption {
  id: string;
  label: string;
  modes: string[];
  is_default: boolean;
}

interface ModelSelectorProps {
  /** Hangi sohbet modunun modelleri listelenecek. */
  mode: "rag" | "general";
  /** Seçili model id'si (henüz seçim yoksa null). */
  value: string | null;
  onChange: (modelId: string) => void;
  disabled?: boolean;
}

type LoadStatus = "loading" | "ready" | "error";

/**
 * Sunucu tarafı allowlist'ten (GET /chat/models) model seçimi.
 * - Kullanıcı yalnızca dönen modeller arasından seçer; context window gibi
 *   üretim parametreleri için hiçbir girdi/slider sunulmaz (server-side).
 * - Liste yüklenemezse anlaşılır bir hata ve tekrar dene butonu gösterir.
 */
export default function ModelSelector({
  mode,
  value,
  onChange,
  disabled = false,
}: ModelSelectorProps) {
  const { token } = useAuth();
  const [models, setModels] = useState<ModelOption[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const loadModels = useCallback(() => {
    return apiFetch<ModelOption[]>(`/chat/models?mode=${mode}`, { token })
      .then((data) => {
        setModels(data);
        setError(null);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        setModels([]);
        setError(getErrorMessage(err, "Model listesi yüklenemedi."));
        setStatus("error");
      });
  }, [mode, token]);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  // Seçim listeyle tutarlı tutulur: seçim yoksa (veya artık listede değilse)
  // backend'in işaretlediği varsayılan modele düşülür.
  useEffect(() => {
    if (models.length === 0) return;
    if (value && models.some((m) => m.id === value)) return;
    const fallback = models.find((m) => m.is_default) ?? models[0];
    onChange(fallback.id);
  }, [models, value, onChange]);

  if (status === "error") {
    return (
      <div
        role="alert"
        style={{
          ...g.alertError,
          padding: "0.45rem 0.7rem",
          fontSize: "0.8rem",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            gap: "0.45rem",
            alignItems: "center",
            minWidth: 0,
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          {error}
        </span>
        <button
          type="button"
          onClick={() => {
            setStatus("loading");
            void loadModels();
          }}
          className="ld-btn"
          style={{
            ...g.smallButton,
            color: "inherit",
            border: "1px solid currentColor",
            background: "transparent",
            flexShrink: 0,
          }}
        >
          <RefreshCw size={12} />
          Tekrar dene
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        flexWrap: "wrap",
        minWidth: 0,
      }}
    >
      <label
        htmlFor={`model-selector-${mode}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          fontSize: "0.72rem",
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: t.color.subtle,
          flexShrink: 0,
        }}
      >
        <Cpu size={13} />
        Model
      </label>
      <select
        id={`model-selector-${mode}`}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || status === "loading" || models.length === 0}
        style={{
          ...g.input,
          width: "auto",
          maxWidth: "100%",
          minWidth: 0,
          padding: "0.42rem 0.6rem",
          fontSize: "0.82rem",
          cursor: status === "loading" ? "wait" : "pointer",
        }}
      >
        {status === "loading" ? (
          <option value="">Modeller yükleniyor…</option>
        ) : (
          models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
              {model.is_default ? " (varsayılan)" : ""}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
