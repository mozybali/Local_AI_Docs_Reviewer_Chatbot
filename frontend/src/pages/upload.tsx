import { useState } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { ui } from "../lib/ui";
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
          style={{ ...ui.panel, maxWidth: 520 }}
          className="ld-card ld-fade-in"
        >
          <h1 style={ui.title}>Doküman Yükle</h1>
          <p style={ui.subtitle}>
            PDF, TXT veya DOCX dosyası yükleyin. Yükleme sonrası işleme arka
            planda yapılır.
          </p>

          {result && (
            <div style={ui.success} className="ld-fade-in">
              Dosya alındı: <strong>{result.filename}</strong>
              <br />
              Doküman ID: {result.document_id} — Durum: {result.status}
              <br />
              İşleme arka planda sürüyor.{" "}
              <Link href="/documents">Dokümanlarım</Link> sayfasından
              takip edebilirsiniz.
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
