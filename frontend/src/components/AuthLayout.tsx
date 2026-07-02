import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { Database, FileText, Lock, ShieldCheck } from "lucide-react";
import { glass as g, tokens as t } from "../lib/ui";

type Icon = ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;

const VALUE_PROPS: { icon: Icon; title: string; desc: string }[] = [
  {
    icon: Lock,
    title: "Tamamen lokal",
    desc: "Doküman içeriği bulut servislerine gönderilmez.",
  },
  {
    icon: FileText,
    title: "Kaynaklı cevaplar",
    desc: "Her yanıt dosya adı ve sayfa referansıyla gelir.",
  },
  {
    icon: ShieldCheck,
    title: "Güvenli erişim",
    desc: "JWT kimlik doğrulaması ve kullanıcı bazlı izolasyon.",
  },
];

interface AuthLayoutProps {
  /** Sağ paneldeki form içeriği. */
  children: ReactNode;
}

/**
 * Login/Register sayfalarının paylaştığı iki panelli auth yerleşimi.
 * Solda marka ve ürün sinyali, sağda form; mobilde yalnızca form kalır.
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div
      className="ld-page"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Dekoratif ışık halkaları */}
      <div className="ld-auth-orb ld-auth-orb--blue" aria-hidden="true" />
      <div className="ld-auth-orb ld-auth-orb--cyan" aria-hidden="true" />

      <div className="ld-auth-grid">
        {/* Sol: marka paneli */}
        <aside
          className="ld-auth-side ld-glass"
          style={{
            ...g.glassPanel,
            background: `radial-gradient(420px 260px at 20% 0%, rgba(37, 99, 235, 0.18), transparent 70%), ${t.color.glass}`,
            padding: "2.25rem 2rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "2.5rem",
          }}
        >
          <Link href="/" style={g.brand}>
            <span style={g.brandMark}>
              <Database size={16} />
            </span>
            LocalDoc <span style={{ color: t.color.primarySoft }}>AI</span>
          </Link>

          <div>
            <h2
              style={{
                margin: "0 0 0.6rem",
                fontSize: "1.5rem",
                lineHeight: 1.3,
                letterSpacing: "-0.4px",
                color: t.color.heading,
              }}
            >
              Dokümanlarınız için lokal, kaynaklı yapay zeka
            </h2>
            <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.6, color: t.color.muted }}>
              PDF ve TXT dokümanlarınızı yükleyin; cevaplar yalnızca sizin
              içeriklerinize dayansın.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {VALUE_PROPS.map(({ icon: PropIcon, title, desc }) => (
              <div key={title} style={{ display: "flex", gap: "0.7rem", alignItems: "flex-start" }}>
                <span style={{ ...g.iconWrap, width: 32, height: 32 }}>
                  <PropIcon size={15} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: t.color.heading,
                    }}
                  >
                    {title}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.78rem",
                      lineHeight: 1.5,
                      color: t.color.muted,
                      marginTop: "0.1rem",
                    }}
                  >
                    {desc}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </aside>

        {/* Sağ: form paneli */}
        <div className="ld-auth-form">{children}</div>
      </div>

      <style jsx>{`
        .ld-auth-grid {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 860px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 1.25rem;
          align-items: stretch;
        }
        .ld-auth-form {
          display: flex;
          align-items: center;
        }
        .ld-auth-orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
          z-index: 0;
        }
        .ld-auth-orb--blue {
          width: 420px;
          height: 420px;
          top: -120px;
          right: -80px;
          background: rgba(37, 99, 235, 0.16);
          animation: ld-float 9s ease-in-out infinite;
        }
        .ld-auth-orb--cyan {
          width: 340px;
          height: 340px;
          bottom: -110px;
          left: -70px;
          background: rgba(34, 211, 238, 0.1);
          animation: ld-float 11s ease-in-out infinite reverse;
        }
        @media (max-width: 760px) {
          .ld-auth-grid {
            grid-template-columns: 1fr;
            max-width: 440px;
          }
          .ld-auth-side {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
