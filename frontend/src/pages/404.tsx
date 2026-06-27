import Link from "next/link";
import { ui } from "../lib/ui";

export default function NotFoundPage() {
  return (
    <div style={ui.page} className="ld-page">
      <div
        style={{ ...ui.card, textAlign: "center" }}
        className="ld-card ld-fade-in"
      >
        <div style={{ fontSize: "3rem", fontWeight: 800, color: "#2563eb" }}>
          404
        </div>
        <h1 style={ui.title}>Sayfa bulunamadı.</h1>
        <p style={ui.subtitle}>
          Aradığınız sayfa taşınmış veya hiç var olmamış olabilir.
        </p>
        <Link href="/">
          <button style={ui.button}>Ana sayfaya dön</button>
        </Link>
      </div>
    </div>
  );
}
