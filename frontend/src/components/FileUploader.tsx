import {
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { AlertCircle, FileText, FileUp, UploadCloud, X } from "lucide-react";
import { apiFetch, getErrorMessage } from "../lib/api";
import { glass as g, tokens as t, ui } from "../lib/ui";
import Spinner from "./Spinner";

export interface UploadResult {
  document_id: number;
  filename: string;
  status: string;
}

interface FileUploaderProps {
  token: string | null;
  onUploaded: (result: UploadResult) => void;
}

// İstemci tarafı doğrulama (backend de ayrıca doğrular).
const ALLOWED_EXTENSIONS = ["pdf", "txt", "docx"];
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Uzantıya göre dosya ikonu rengi (görsel ayrım için).
const EXT_COLORS: Record<string, string> = {
  pdf: t.color.danger,
  txt: t.color.muted,
  docx: t.color.primarySoft,
};

function extensionOf(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validate(file: File): string | null {
  const ext = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Desteklenmeyen dosya türü (.${ext || "?"}). İzin verilenler: ${ALLOWED_EXTENSIONS.join(", ")}.`;
  }
  if (file.size === 0) {
    return "Dosya boş görünüyor.";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Dosya çok büyük (${formatSize(file.size)}). En fazla ${MAX_FILE_SIZE_MB} MB yükleyebilirsiniz.`;
  }
  return null;
}

/**
 * Sürükle-bırak destekli, istemci tarafında doğrulama yapan dosya yükleme
 * bileşeni. Seçilen dosyayı backend'e gönderir ve sonucu `onUploaded` ile
 * üst bileşene bildirir.
 */
export default function FileUploader({ token, onUploaded }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function chooseFile(next: File | null) {
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    const validationError = validate(next);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }
    setFile(next);
  }

  function removeFile() {
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    chooseFile(e.dataTransfer.files?.[0] ?? null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Lütfen bir dosya seçin.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    setError(null);
    try {
      const data = await apiFetch<UploadResult>("/documents/upload", {
        method: "POST",
        token,
        body: formData,
      });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onUploaded(data);
    } catch (err) {
      setError(getErrorMessage(err, "Yükleme sırasında bir hata oluştu."));
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div style={ui.error} className="ld-fade-in" role="alert">
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Sürükle-bırak alanı */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label="Dosya seç veya sürükleyip bırak"
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !uploading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        style={{
          position: "relative",
          overflow: "hidden",
          border: `1.5px dashed ${dragOver ? "rgba(96, 165, 250, 0.75)" : t.color.borderStrong}`,
          background: dragOver ? "rgba(37, 99, 235, 0.1)" : "rgba(5, 10, 22, 0.45)",
          boxShadow: dragOver
            ? "inset 0 0 44px rgba(37, 99, 235, 0.22)"
            : t.shadow.insetHi,
          borderRadius: t.radius.md,
          padding: "1.9rem 1rem",
          textAlign: "center",
          cursor: uploading ? "not-allowed" : "pointer",
          transition:
            "border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease",
          marginBottom: "1rem",
        }}
      >
        <span
          style={{
            ...g.iconWrap,
            width: 46,
            height: 46,
            marginBottom: "0.6rem",
            transform: dragOver ? "translateY(-2px)" : undefined,
            transition: "transform 0.18s ease",
          }}
        >
          <UploadCloud size={21} />
        </span>
        <div style={{ color: t.color.muted, fontSize: "0.9rem" }}>
          Dosyayı buraya sürükleyin ya da{" "}
          <span style={{ color: t.color.primarySoft, fontWeight: 600 }}>
            seçmek için tıklayın
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "0.4rem",
            marginTop: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          {ALLOWED_EXTENSIONS.map((ext) => (
            <span
              key={ext}
              style={{
                ...g.badge,
                padding: "0.22rem 0.5rem",
                fontSize: "0.68rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <FileText size={11} color={EXT_COLORS[ext]} />
              {ext}
            </span>
          ))}
          <span
            style={{
              ...g.badge,
              padding: "0.22rem 0.5rem",
              fontSize: "0.68rem",
            }}
          >
            maks. {MAX_FILE_SIZE_MB} MB
          </span>
        </div>
      </div>

      {/* Seçilen dosya özeti */}
      {file && (
        <div
          className="ld-fade-in"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.65rem",
            padding: "0.65rem 0.75rem",
            borderRadius: t.radius.md,
            background: "rgba(37, 99, 235, 0.08)",
            border: "1px solid rgba(96, 165, 250, 0.32)",
            marginBottom: "1rem",
          }}
        >
          <span style={{ ...g.iconWrap, width: 34, height: 34 }}>
            <FileText size={16} color={EXT_COLORS[extensionOf(file.name)] ?? t.color.primarySoft} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: t.color.heading,
                wordBreak: "break-all",
              }}
            >
              {file.name}
            </span>
            <span style={{ display: "block", fontSize: "0.75rem", color: t.color.muted }}>
              {formatSize(file.size)} · .{extensionOf(file.name)}
            </span>
          </span>
          <button
            type="button"
            onClick={removeFile}
            disabled={uploading}
            aria-label="Seçilen dosyayı kaldır"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              padding: 0,
              borderRadius: t.radius.sm,
              background: "transparent",
              border: `1px solid ${t.color.borderStrong}`,
              color: t.color.muted,
              cursor: uploading ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      <input
        id="file"
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.docx"
        style={{ display: "none" }}
        onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
      />

      <button
        type="submit"
        className="ld-btn"
        style={{
          ...ui.button,
          ...(uploading || !file ? ui.buttonDisabled : {}),
        }}
        disabled={uploading || !file}
      >
        {uploading ? <Spinner size={16} color="#fff" /> : <FileUp size={16} />}
        {uploading ? "Yükleniyor..." : "Yükle"}
      </button>
    </form>
  );
}
