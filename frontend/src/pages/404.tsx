import Link from "next/link";
import { Home, SearchX } from "lucide-react";
import { glass as g, tokens as t, ui } from "../lib/ui";

export default function NotFoundPage() {
  return (
    <div style={ui.page} className="ld-page">
      <div
        style={{ ...ui.card, textAlign: "center" }}
        className="ld-card ld-glass ld-fade-up"
      >
        <span
          style={{
            ...g.iconWrap,
            width: 52,
            height: 52,
            margin: "0 auto 1rem",
          }}
        >
          <SearchX size={24} />
        </span>
        <div
          style={{
            fontSize: "3rem",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-1px",
            background: "linear-gradient(90deg, #60a5fa, #22d3ee)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: "0.5rem",
          }}
        >
          404
        </div>
        <h1 style={ui.title}>Sayfa bulunamadı</h1>
        <p style={ui.subtitle}>
          Aradığınız sayfa taşınmış veya hiç var olmamış olabilir.
        </p>
        <Link href="/" className="ld-btn" style={{ ...g.glassButton, width: "100%" }}>
          <Home size={15} color={t.color.heading} />
          Ana sayfaya dön
        </Link>
      </div>
    </div>
  );
}
