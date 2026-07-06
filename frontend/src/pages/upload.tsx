import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, UploadCloud } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { glass as g, tokens as t, ui } from "../lib/ui";
import ProtectedRoute from "../components/ProtectedRoute";
import Header from "../components/Header";
import FileUploader, { type UploadResult } from "../components/FileUploader";

function UploadContent() {
  const { token } = useAuth();
  const [result, setResult] = useState<UploadResult | null>(null);

  return (
    <div style={ui.contentPage}>
      <Header />
      <main style={ui.contentBody} className="ld-page">
        <div
          style={{ ...ui.panel, maxWidth: 560 }}
          className="ld-card ld-glass ld-fade-up"
        >
          <h1 style={ui.pageTitle}>
            <span style={{ ...g.iconWrap, width: 34, height: 34 }}>
              <UploadCloud size={16} />
            </span>
            Doküman Yükle
          </h1>
          <p style={{ ...ui.pageSubtitle, marginBottom: "1.5rem" }}>
            PDF, TXT, DOCX veya görüntü (PNG/JPG) dosyası yükleyin. Taranmış
            belgeler ve görüntüler lokal OCR ile okunur; işleme arka planda
            yapılır.
          </p>

          {result && (
            <div style={ui.success} className="ld-fade-in">
              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Dosya alındı: <strong>{result.filename}</strong>
                <br />
                Doküman ID: {result.document_id} — Durum: {result.status}
                <br />
                İşleme arka planda sürüyor.{" "}
                <Link href="/documents" style={{ color: t.color.emerald, fontWeight: 600 }}>
                  Dokümanlarım
                </Link>{" "}
                sayfasından takip edebilirsiniz.
              </span>
            </div>
          )}

          <FileUploader token={token} onUploaded={setResult} />

          <p style={ui.footerText}>
            <Link href="/documents">Dokümanlarım</Link>
            {" · "}
            <Link href="/">Ana sayfa</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function UploadPage() {
  return (
    <ProtectedRoute>
      <UploadContent />
    </ProtectedRoute>
  );
}
