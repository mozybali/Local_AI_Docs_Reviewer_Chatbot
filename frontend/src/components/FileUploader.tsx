import {
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { apiFetch, getErrorMessage } from "../lib/api";
import { ui } from "../lib/ui";
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
          {error}
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
        style={{
          border: `2px dashed ${dragOver ? "#2563eb" : "#334155"}`,
          background: dragOver ? "rgba(37, 99, 235, 0.08)" : "#0f172a",
          borderRadius: 10,
          padding: "1.75rem 1rem",
          textAlign: "center",
          cursor: uploading ? "not-allowed" : "pointer",
          transition: "border-color 0.15s ease, background 0.15s ease",
          marginBottom: "1rem",
        }}
      >
        <div style={{ fontSize: "1.75rem", marginBottom: "0.4rem" }}>📄</div>
        {file ? (
          <div>
            <strong style={{ wordBreak: "break-all" }}>{file.name}</strong>
            <div style={{ color: "#94a3b8", fontSize: "0.8rem", marginTop: "0.2rem" }}>
              {formatSize(file.size)} · Yüklemek için butona basın
            </div>
          </div>
        ) : (
          <div style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
            Dosyayı buraya sürükleyin ya da{" "}
            <span style={{ color: "#60a5fa", fontWeight: 600 }}>seçmek için tıklayın</span>
            <div style={{ fontSize: "0.78rem", marginTop: "0.3rem" }}>
              PDF, TXT veya DOCX · maks. {MAX_FILE_SIZE_MB} MB
            </div>
          </div>
        )}
      </div>

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
        style={{
          ...ui.button,
          ...(uploading || !file ? ui.buttonDisabled : {}),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
        }}
        disabled={uploading || !file}
      >
        {uploading && <Spinner size={16} color="#fff" />}
        {uploading ? "Yükleniyor..." : "Yükle"}
      </button>
    </form>
  );
}
