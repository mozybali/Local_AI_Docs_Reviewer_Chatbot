import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, type ComponentType, type ReactNode } from "react";
import {
  Shield,
  Lock,
  FileText,
  Search,
  Database,
  MessageSquare,
  UploadCloud,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { landing as lp, tokens as t } from "../lib/ui";
import Spinner from "../components/Spinner";

type Icon = ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;

// --- Statik içerik tanımları (tek kaynaktan yönetilir) ---

const TRUST_BADGES: { icon: Icon; label: string }[] = [
  { icon: Shield, label: "Lokal AI" },
  { icon: Lock, label: "JWT Auth" },
  { icon: FileText, label: "Kaynaklı Cevaplar" },
  { icon: Database, label: "ChromaDB RAG" },
  { icon: CheckCircle, label: "Admin Paneli" },
];

const FEATURES: { icon: Icon; title: string; desc: string }[] = [
  {
    icon: Lock,
    title: "Lokal ve gizli çalışma",
    desc: "Doküman içeriği bulut tabanlı LLM servislerine gönderilmez.",
  },
  {
    icon: Search,
    title: "RAG tabanlı cevap üretimi",
    desc: "Cevaplar semantik olarak getirilen doküman parçalarına dayanır.",
  },
  {
    icon: FileText,
    title: "Kaynak gösterimi",
    desc: "Yanıtlarla birlikte dosya adı ve sayfa bilgisi gösterilir.",
  },
  {
    icon: Shield,
    title: "Çok kullanıcılı yapı",
    desc: "JWT ve kullanıcı bazlı izolasyon ile herkes yalnızca kendi dokümanlarına erişir.",
  },
];

const FLOW_STEPS: { icon: Icon; label: string }[] = [
  { icon: UploadCloud, label: "Dokümanı yükle" },
  { icon: FileText, label: "Sistem metni çıkarır" },
  { icon: Database, label: "Chunk + embedding üretir" },
  { icon: MessageSquare, label: "Soru sor" },
  { icon: CheckCircle, label: "Kaynaklı cevabı al" },
];

const QUICK_ACTIONS: { icon: Icon; label: string; href: string }[] = [
  { icon: MessageSquare, label: "Soru Sor", href: "/chat" },
  { icon: UploadCloud, label: "Doküman Yükle", href: "/upload" },
  { icon: FileText, label: "Dokümanlarım", href: "/documents" },
];

/**
 * Tamamen statik, CSS ile çizilmiş ürün önizlemesi.
 * Hiçbir backend isteği yapmaz; yalnızca arayüz hissini gösterir.
 */
function ProductMockup() {
  return (
    <div
      className="ld-mock"
      aria-hidden="true"
      role="presentation"
      style={{
        ...lp.glassPanel,
        padding: "0.9rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem",
      }}
    >
      {/* Mini header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          paddingBottom: "0.7rem",
          borderBottom: `1px solid ${t.color.border}`,
        }}
      >
        <span style={{ display: "flex", gap: "0.35rem" }}>
          <Dot color="#f87171" />
          <Dot color="#fbbf24" />
          <Dot color="#34d399" />
        </span>
        <span style={{ fontSize: "0.74rem", color: t.color.subtle, marginLeft: "0.3rem" }}>
          LocalDoc AI — workspace
        </span>
      </div>

      <div className="ld-mock__body" style={{ display: "flex", gap: "0.7rem" }}>
        {/* Doküman listesi */}
        <div
          className="ld-mock__docs"
          style={{
            width: 168,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.45rem",
          }}
        >
          <span style={{ fontSize: "0.68rem", color: t.color.subtle, fontWeight: 700, letterSpacing: "0.4px" }}>
            DOKÜMANLAR
          </span>
          <MockDoc name="annual_report.pdf" status="ready" />
          <MockDoc name="policy.txt" status="processing" />
          <MockDoc name="research_notes.pdf" status="ready" />
        </div>

        {/* Chat örneği */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: 0 }}>
          <MockBubble role="user">Bu dokümandaki ana riskler neler?</MockBubble>
          <MockBubble role="assistant">
            Dokümanda belirtilen ana riskler operasyonel bağımlılık, regülasyon
            değişiklikleri ve likidite baskısı olarak özetleniyor.
          </MockBubble>

          {/* Kaynak paneli */}
          <div
            style={{
              marginTop: "0.2rem",
              padding: "0.55rem 0.6rem",
              borderRadius: t.radius.sm,
              background: "rgba(15, 23, 42, 0.5)",
              border: `1px solid ${t.color.border}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.4rem" }}>
              <FileText size={12} color={t.color.accentSoft} />
              <span style={{ fontSize: "0.66rem", color: t.color.subtle, fontWeight: 700, letterSpacing: "0.4px" }}>
                KAYNAKLAR
              </span>
            </div>
            <MockSource text="annual_report.pdf, page 4" />
            <MockSource text="policy.txt, page 2" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, display: "inline-block" }} />;
}

function MockDoc({ name, status }: { name: string; status: "ready" | "processing" }) {
  const ready = status === "ready";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.45rem",
        padding: "0.45rem 0.5rem",
        borderRadius: t.radius.sm,
        background: "rgba(15, 23, 42, 0.45)",
        border: `1px solid ${t.color.border}`,
      }}
    >
      <FileText size={13} color={t.color.muted} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: "0.7rem",
          color: t.color.text,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
      <span
        style={{
          fontSize: "0.6rem",
          fontWeight: 700,
          color: ready ? t.color.green : t.color.warning,
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: ready ? t.color.green : t.color.warning,
            animation: ready ? undefined : "ld-pulse 1.4s ease-in-out infinite",
          }}
        />
        {status}
      </span>
    </div>
  );
}

function MockBubble({ role, children }: { role: "user" | "assistant"; children: ReactNode }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <span
        style={{
          maxWidth: "85%",
          padding: "0.5rem 0.65rem",
          borderRadius: t.radius.md,
          fontSize: "0.74rem",
          lineHeight: 1.5,
          background: isUser ? "rgba(37, 99, 235, 0.85)" : "rgba(30, 41, 59, 0.7)",
          color: isUser ? "#eff6ff" : t.color.text,
          border: `1px solid ${isUser ? "rgba(96,165,250,0.5)" : t.color.border}`,
        }}
      >
        {children}
      </span>
    </div>
  );
}

function MockSource({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.15rem 0" }}>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: t.color.accentSoft }} />
      <span style={{ fontSize: "0.68rem", color: t.color.muted }}>{text}</span>
    </div>
  );
}

export default function HomePage() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const router = useRouter();
  // ProtectedRoute, yetkisiz bir sayfadan (ör. /admin) buraya yönlendirdiğinde
  // `?denied=admin` ekler; kullanıcı neden ana sayfaya düştüğünü görsün.
  const accessDenied = router.query.denied === "admin";
  const isAdmin = user?.role === "admin";

  // Mouse hareketine göre arka planda ışıyan glow.
  // CSS değişkenlerini rAF ile güncelleriz; React yeniden render edilmez.
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        el.style.setProperty("--ld-mx", `${e.clientX}px`);
        el.style.setProperty("--ld-my", `${e.clientY}px`);
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const deniedAlert = accessDenied ? (
    <div style={lp.alert} className="ld-fade-in" role="alert">
      <Shield size={16} />
      Bu sayfaya erişim yetkiniz yok; ana sayfaya yönlendirildiniz.
    </div>
  ) : null;

  return (
    <div ref={shellRef} style={lp.shell}>
      {/* Mouse'u takip eden, mavi–cyan tonlarında ışıyan arka plan katmanı */}
      <div className="ld-cursor-glow" aria-hidden="true" />

      {/* Üst navigasyon */}
      <header style={lp.nav}>
        <nav
          className="ld-nav-inner"
          style={{
            ...lp.container,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            padding: "0.7rem 1.25rem",
          }}
        >
          <Link href="/" style={lp.brand}>
            <span style={lp.brandMark}>
              <Database size={16} />
            </span>
            LocalDoc <span style={{ color: t.color.accentSoft }}>AI</span>
          </Link>

          {loading ? (
            <Spinner size={18} />
          ) : isAuthenticated ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span
                className="ld-nav-email"
                style={{
                  fontSize: "0.8rem",
                  color: t.color.muted,
                  maxWidth: 220,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={user?.email}
              >
                {user?.email}
                {isAdmin ? " (admin)" : ""}
              </span>
              <button
                type="button"
                onClick={logout}
                className="ld-btn"
                style={{ ...lp.btnBase, ...lp.btnDanger, padding: "0.5rem 0.85rem", fontSize: "0.82rem" }}
              >
                Çıkış Yap
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Link
                href="/login"
                className="ld-btn"
                style={{ ...lp.btnBase, ...lp.btnSecondary, padding: "0.5rem 0.95rem", fontSize: "0.85rem" }}
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="ld-btn"
                style={{ ...lp.btnBase, ...lp.btnPrimary, padding: "0.5rem 0.95rem", fontSize: "0.85rem" }}
              >
                Sign up
              </Link>
            </div>
          )}
        </nav>
      </header>

      {loading ? (
        <div style={{ ...lp.container, position: "relative", zIndex: 1, padding: "5rem 1.25rem", display: "flex", alignItems: "center", gap: "0.6rem", color: t.color.muted }}>
          <Spinner /> Yükleniyor...
        </div>
      ) : isAuthenticated ? (
        /* ---------- Giriş yapmış kullanıcı: dashboard giriş alanı ---------- */
        <main style={{ ...lp.container, position: "relative", zIndex: 1, padding: "2.5rem 1.25rem 4rem" }} className="ld-fade-in">
          {deniedAlert && <div style={{ marginBottom: "1.5rem" }}>{deniedAlert}</div>}

          <section style={{ ...lp.glassPanel, padding: "1.75rem" }}>
            <span style={lp.kicker}>
              <CheckCircle size={13} /> Oturum aktif
            </span>
            <h1 style={{ ...lp.sectionTitle, margin: "0.9rem 0 0.4rem", fontSize: "1.8rem" }}>
              Hoş geldin, <span style={{ color: t.color.accentSoft }}>{user?.email}</span>
              {isAdmin ? <span style={{ color: t.color.warning, fontSize: "1rem" }}> · admin</span> : null}
            </h1>
            <p style={{ ...lp.sectionLead, marginBottom: "1.5rem" }}>
              Doküman bilgi tabanınla çalışmaya devam et. Hızlı aksiyonlarla soru sor,
              yeni doküman yükle veya mevcut dokümanlarını yönet.
            </p>

            <div className="ld-actions">
              {QUICK_ACTIONS.map(({ icon: ActIcon, label, href }) => (
                <Link key={href} href={href} className="ld-action" style={lp.actionCard}>
                  <span style={lp.iconWrap}>
                    <ActIcon size={20} />
                  </span>
                  <span style={{ flex: 1, fontWeight: 600 }}>{label}</span>
                  <ArrowRight size={16} color={t.color.subtle} />
                </Link>
              ))}

              {isAdmin && (
                <Link
                  href="/admin"
                  className="ld-action"
                  style={{ ...lp.actionCard, border: "1px solid rgba(251, 191, 36, 0.3)" }}
                >
                  <span style={{ ...lp.iconWrap, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)", color: t.color.warning }}>
                    <Shield size={20} />
                  </span>
                  <span style={{ flex: 1, fontWeight: 600 }}>Admin Paneli</span>
                  <ArrowRight size={16} color={t.color.subtle} />
                </Link>
              )}
            </div>
          </section>
        </main>
      ) : (
        /* ---------- Giriş yapmamış kullanıcı: tanıtım sayfası ---------- */
        <main style={{ position: "relative", zIndex: 1 }}>
          {/* Hero */}
          <section style={{ ...lp.container, padding: "3rem 1.25rem 1rem" }} className="ld-fade-in">
            {deniedAlert && <div style={{ marginBottom: "1.75rem" }}>{deniedAlert}</div>}

            <div className="ld-hero">
              <div>
                <span style={lp.kicker}>
                  <Shield size={13} /> Lokal · Gizli · Kaynaklı
                </span>
                <h1
                  style={{
                    margin: "1.1rem 0 1rem",
                    fontSize: "2.5rem",
                    lineHeight: 1.15,
                    letterSpacing: "-1px",
                    color: t.color.heading,
                  }}
                  className="ld-hero-title"
                >
                  Dokümanlarınızla lokal yapay zeka üzerinden konuşun
                </h1>
                <p style={{ ...lp.sectionLead, fontSize: "1.02rem", marginBottom: "1.6rem" }}>
                  LocalDoc AI; PDF ve TXT dokümanlarınızı lokal ortamda işler, semantik
                  arama ile ilgili kaynakları bulur ve cevapları yalnızca yüklenen doküman
                  bağlamına dayanarak üretir.
                </p>

                <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", marginBottom: "1.6rem" }}>
                  <Link href="/register" className="ld-btn" style={{ ...lp.btnBase, ...lp.btnPrimary }}>
                    Sign up <ArrowRight size={16} />
                  </Link>
                  <Link href="/login" className="ld-btn" style={{ ...lp.btnBase, ...lp.btnSecondary }}>
                    Sign in
                  </Link>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {TRUST_BADGES.map(({ icon: BadgeIcon, label }) => (
                    <span key={label} style={lp.badge}>
                      <BadgeIcon size={13} color={t.color.accentSoft} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <ProductMockup />
            </div>
          </section>

          {/* Özellikler */}
          <section style={{ ...lp.container, padding: "3.5rem 1.25rem 1rem" }}>
            <span style={lp.kicker}>
              <Database size={13} /> Mimari
            </span>
            <h2 style={{ ...lp.sectionTitle, marginTop: "0.9rem" }}>Neden LocalDoc AI?</h2>
            <p style={{ ...lp.sectionLead, marginBottom: "1.75rem" }}>
              Gizliliği, kaynaklı cevapları ve çok kullanıcılı yapıyı bir araya getiren
              lokal bir doküman zekası.
            </p>

            <div className="ld-features">
              {FEATURES.map(({ icon: FeatIcon, title, desc }) => (
                <div key={title} className="ld-feature" style={{ ...lp.glassPanel, padding: "1.4rem" }}>
                  <span style={lp.iconWrap}>
                    <FeatIcon size={20} />
                  </span>
                  <h3 style={{ margin: "0.9rem 0 0.4rem", fontSize: "1.05rem", color: t.color.heading }}>
                    {title}
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.6, color: t.color.muted }}>
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Akış */}
          <section style={{ ...lp.container, padding: "3.5rem 1.25rem 1rem" }}>
            <span style={lp.kicker}>
              <Search size={13} /> Nasıl çalışır
            </span>
            <h2 style={{ ...lp.sectionTitle, marginTop: "0.9rem" }}>Yükle, sor, kaynaklı cevabı al</h2>
            <p style={{ ...lp.sectionLead, marginBottom: "1.75rem" }}>
              Dokümandan kaynaklı yanıta kadar tüm süreç lokal olarak işler.
            </p>

            <div className="ld-steps">
              {FLOW_STEPS.map(({ icon: StepIcon, label }, i) => (
                <div key={label} className="ld-step-wrap">
                  <div style={{ ...lp.glassPanel, padding: "1.1rem", display: "flex", alignItems: "center", gap: "0.75rem", height: "100%" }}>
                    <span
                      style={{
                        ...lp.iconWrap,
                        width: 34,
                        height: 34,
                        position: "relative",
                      }}
                    >
                      <StepIcon size={17} />
                      <span
                        style={{
                          position: "absolute",
                          top: -7,
                          left: -7,
                          width: 18,
                          height: 18,
                          borderRadius: t.radius.sm,
                          background: t.color.accent,
                          color: "#fff",
                          fontSize: "0.62rem",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px solid rgba(96,165,250,0.6)",
                        }}
                      >
                        {i + 1}
                      </span>
                    </span>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, color: t.color.text }}>{label}</span>
                  </div>
                  {i < FLOW_STEPS.length - 1 && (
                    <span className="ld-step-arrow" aria-hidden="true">
                      <ArrowRight size={16} color={t.color.subtle} />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Alt CTA */}
          <section style={{ ...lp.container, padding: "3.5rem 1.25rem 4rem" }}>
            <div
              style={{
                ...lp.glassPanel,
                padding: "2.5rem 1.75rem",
                textAlign: "center",
                background:
                  "radial-gradient(600px 220px at 50% 0%, rgba(37,99,235,0.18), transparent 70%)," +
                  t.color.panelStrong,
              }}
            >
              <h2 style={{ ...lp.sectionTitle, margin: "0 auto 0.7rem", maxWidth: 560 }}>
                Kendi doküman bilgi tabanınızı lokal olarak başlatın
              </h2>
              <p style={{ ...lp.sectionLead, margin: "0 auto 1.6rem" }}>
                Birkaç dakikada hesabınızı oluşturun, dokümanlarınızı yükleyin ve kaynaklı
                cevaplar almaya başlayın.
              </p>
              <div style={{ display: "flex", gap: "0.7rem", justifyContent: "center", flexWrap: "wrap" }}>
                <Link href="/register" className="ld-btn" style={{ ...lp.btnBase, ...lp.btnPrimary }}>
                  Sign up <ArrowRight size={16} />
                </Link>
                <Link href="/login" className="ld-btn" style={{ ...lp.btnBase, ...lp.btnSecondary }}>
                  Sign in
                </Link>
              </div>
            </div>
          </section>
        </main>
      )}

      <style jsx>{`
        .ld-cursor-glow {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          mix-blend-mode: screen;
          background:
            radial-gradient(
              560px circle at var(--ld-mx, 50%) var(--ld-my, 26%),
              rgba(37, 99, 235, 0.22),
              transparent 60%
            ),
            radial-gradient(
              900px circle at var(--ld-mx, 50%) var(--ld-my, 26%),
              rgba(34, 211, 238, 0.1),
              transparent 55%
            );
          transition: background 0.12s ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .ld-cursor-glow {
            transition: none;
          }
        }

        .ld-btn:hover {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }
        .ld-btn:active {
          transform: translateY(0);
        }
        .ld-action:hover,
        .ld-feature:hover {
          border-color: ${t.color.borderGlow} !important;
          transform: translateY(-2px);
          box-shadow: 0 14px 34px rgba(3, 7, 18, 0.5);
        }

        .ld-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
          gap: 2.25rem;
          align-items: center;
        }
        .ld-actions {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 0.85rem;
        }
        .ld-features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(228px, 1fr));
          gap: 1rem;
        }
        .ld-steps {
          display: flex;
          align-items: stretch;
          gap: 0.5rem;
        }
        .ld-step-wrap {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
        }
        .ld-step-wrap > div:first-child {
          flex: 1;
        }
        .ld-step-arrow {
          display: inline-flex;
          flex-shrink: 0;
        }

        @media (max-width: 880px) {
          .ld-hero {
            grid-template-columns: 1fr;
            gap: 1.75rem;
          }
          .ld-hero-title {
            font-size: 2.1rem !important;
          }
          .ld-steps {
            flex-direction: column;
          }
          .ld-step-wrap {
            flex-direction: column;
            align-items: stretch;
          }
          .ld-step-arrow {
            justify-content: center;
            transform: rotate(90deg);
          }
        }

        @media (max-width: 560px) {
          .ld-hero-title {
            font-size: 1.8rem !important;
          }
          .ld-nav-email {
            display: none;
          }
          .ld-mock__body {
            flex-direction: column;
          }
          .ld-mock__docs {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
