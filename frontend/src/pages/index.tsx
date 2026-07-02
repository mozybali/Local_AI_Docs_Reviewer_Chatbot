import Link from "next/link";
import { useRouter } from "next/router";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  Cpu,
  Database,
  FileSearch,
  FileText,
  FileUp,
  Layers,
  Lock,
  MessageSquare,
  MousePointer2,
  Search,
  SendHorizontal,
  Shield,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { glass as g, tokens as t } from "../lib/ui";
import { useReducedMotion } from "../lib/useReducedMotion";
import Spinner from "../components/Spinner";
import Reveal from "../components/Reveal";

type Icon = ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;

// --- Statik içerik tanımları (tek kaynaktan yönetilir) ---

const TRUST_BADGES: { icon: Icon; label: string }[] = [
  { icon: Shield, label: "Lokal AI" },
  { icon: Lock, label: "JWT Auth" },
  { icon: FileText, label: "Kaynaklı Cevaplar" },
  { icon: Database, label: "ChromaDB RAG" },
  { icon: CheckCircle2, label: "Admin Paneli" },
];

const FEATURES: { icon: Icon; title: string; desc: string }[] = [
  {
    icon: Lock,
    title: "Veriler lokalde kalır",
    desc: "Doküman içeriği bulut tabanlı LLM servislerine gönderilmez; işleme tamamen kendi ortamınızda yapılır.",
  },
  {
    icon: Search,
    title: "RAG tabanlı cevaplar",
    desc: "Cevaplar semantik arama ile getirilen doküman parçalarına dayanır; model serbest tahmin yürütmez.",
  },
  {
    icon: FileText,
    title: "Her cevapta kaynak",
    desc: "Yanıtlarla birlikte dosya adı, sayfa numarası ve eşleşme skoru şeffaf biçimde gösterilir.",
  },
  {
    icon: Users,
    title: "Kullanıcı bazlı izolasyon",
    desc: "JWT kimlik doğrulaması ile her kullanıcı yalnızca kendi dokümanlarına erişir.",
  },
];

const FLOW_STEPS: { icon: Icon; title: string; desc: string }[] = [
  {
    icon: UploadCloud,
    title: "Dokümanı yükle",
    desc: "PDF, TXT veya DOCX dosyanız güvenli şekilde alınır ve işleme kuyruğuna eklenir.",
  },
  {
    icon: FileText,
    title: "Metin çıkarılır",
    desc: "Sayfa bilgisi korunarak doküman içeriği ayrıştırılır.",
  },
  {
    icon: Layers,
    title: "Chunk + embedding üretilir",
    desc: "Metin anlamlı parçalara bölünür, vektörleştirilir ve ChromaDB üzerinde saklanır.",
  },
  {
    icon: MessageSquare,
    title: "Sorunuzu sorun",
    desc: "Semantik arama, sorunuzla en alakalı doküman parçalarını getirir.",
  },
  {
    icon: CheckCircle2,
    title: "Kaynaklı cevabı alın",
    desc: "Lokal model, yalnızca getirilen bağlama dayanarak kaynak referanslı cevap üretir.",
  },
];

const USE_CASES: { icon: Icon; title: string; desc: string }[] = [
  {
    icon: Building2,
    title: "Kurumsal bilgi tabanı",
    desc: "Prosedür, politika ve süreç dokümanlarını tek yerden sorgulanabilir hale getirin.",
  },
  {
    icon: FileSearch,
    title: "Rapor ve sözleşme analizi",
    desc: "Uzun raporlarda aradığınız maddeyi sayfa referansıyla saniyeler içinde bulun.",
  },
  {
    icon: BookOpen,
    title: "Araştırma ve ders notları",
    desc: "Akademik PDF ve notlarınızı kaynak gösteren bir çalışma asistanına dönüştürün.",
  },
];

const QUICK_ACTIONS: { icon: Icon; label: string; desc: string; href: string }[] = [
  {
    icon: MessageSquare,
    label: "Soru Sor",
    desc: "Dokümanlarına kaynaklı sorular sor",
    href: "/chat",
  },
  {
    icon: UploadCloud,
    label: "Doküman Yükle",
    desc: "PDF, TXT veya DOCX ekle",
    href: "/upload",
  },
  {
    icon: FileText,
    label: "Dokümanlarım",
    desc: "İşleme durumlarını izle ve yönet",
    href: "/documents",
  },
];

// =============================================================
// PromoStage — otomatik oynayan, tamamen statik ürün turu.
// Backend'e istek atmaz; tek bir frame sayacından tüm sahne
// durumları türetilir (video hissi veren deterministik timeline).
// =============================================================

const SCENE_LABELS = [
  "Doküman yükleniyor",
  "Chunk + embedding oluşturuluyor",
  "Kullanıcı soru soruyor",
  "AI kaynaklara dayanarak yanıtlıyor",
  "Kaynak paneli inceleniyor",
] as const;

const SCENE_COUNT = SCENE_LABELS.length;
const FRAMES_PER_SCENE = 44; // 44 kare × 80ms ≈ 3.5sn / sahne
const TICK_MS = 80;
const TOTAL_FRAMES = SCENE_COUNT * FRAMES_PER_SCENE;

const DEMO_QUESTION = "Bu dokümandaki ana riskler neler?";
const DEMO_ANSWER =
  "Raporda öne çıkan riskler: operasyonel bağımlılık, regülasyon değişiklikleri ve likidite baskısı (s. 4).";

// Sahne başına imlecin durduğu nokta (yüzde cinsinden).
const CURSOR_POS: { top: string; left: string }[] = [
  { top: "40%", left: "18%" },
  { top: "48%", left: "62%" },
  { top: "86%", left: "66%" },
  { top: "58%", left: "40%" },
  { top: "70%", left: "30%" },
];

const CHUNK_CELLS = 21;

function PromoStage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(0);
  const [running, setRunning] = useState(true);
  // Hareket azaltma tercihi: tur oynatılmaz, son sahne statik gösterilir.
  const reduced = useReducedMotion();

  // Görünür değilken zamanlayıcı durur (performans).
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setRunning(entry.isIntersecting),
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !running) return;
    const id = setInterval(
      () => setFrame((f) => (f + 1) % TOTAL_FRAMES),
      TICK_MS,
    );
    return () => clearInterval(id);
  }, [reduced, running]);

  const effFrame = reduced ? TOTAL_FRAMES - 1 : frame;
  const scene = Math.floor(effFrame / FRAMES_PER_SCENE);
  const local = effFrame % FRAMES_PER_SCENE;

  // Sahnelerden türetilen durumlar
  const uploadProgress = scene === 0 ? Math.min(1, local / 30) : 1;
  const litChunks =
    scene < 1 ? 0 : scene === 1 ? Math.ceil((local / FRAMES_PER_SCENE) * CHUNK_CELLS) : CHUNK_CELLS;
  const typedInput =
    scene === 2
      ? DEMO_QUESTION.slice(
          0,
          Math.ceil((local / (FRAMES_PER_SCENE - 6)) * DEMO_QUESTION.length),
        )
      : "";
  const showQuestionBubble = scene >= 3;
  const answerTyping = scene === 3 && local <= 12;
  const typedAnswer =
    scene < 3
      ? ""
      : scene === 3
        ? answerTyping
          ? ""
          : DEMO_ANSWER.slice(
              0,
              Math.ceil(((local - 12) / (FRAMES_PER_SCENE - 14)) * DEMO_ANSWER.length),
            )
        : DEMO_ANSWER;
  const showSources = scene >= 4;
  const docState: "uploading" | "processing" | "ready" =
    scene === 0 ? "uploading" : scene === 1 ? "processing" : "ready";

  const chip: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem",
    fontSize: "0.66rem",
    fontWeight: 700,
    letterSpacing: "0.4px",
    color: t.color.muted,
  };

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="ld-glass"
      style={{
        ...g.glassPanel,
        position: "relative",
        overflow: "hidden",
        padding: "0.9rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem",
      }}
    >
      {/* Pencere üst çubuğu */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          paddingBottom: "0.65rem",
          borderBottom: `1px solid ${t.color.border}`,
        }}
      >
        <span style={{ display: "flex", gap: "0.35rem" }}>
          <StageDot color="#f87171" />
          <StageDot color="#fbbf24" />
          <StageDot color="#34d399" />
        </span>
        <span style={{ fontSize: "0.72rem", color: t.color.subtle, marginLeft: "0.3rem" }}>
          LocalDoc AI — workspace
        </span>
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: "0.64rem",
            fontWeight: 700,
            letterSpacing: "0.6px",
            color: t.color.danger,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: t.color.danger,
              animation: "ld-pulse 1.4s ease-in-out infinite",
            }}
          />
          OTOMATİK TUR
        </span>
      </div>

      {/* Gövde: doküman listesi + çalışma alanı */}
      <div className="ld-mock-body" style={{ display: "flex", gap: "0.7rem" }}>
        {/* Sol: dokümanlar */}
        <div
          className="ld-mock-docs"
          style={{
            width: 168,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.45rem",
          }}
        >
          <span style={chip}>DOKÜMANLAR</span>
          <StageDoc
            name="annual_report.pdf"
            state={docState}
            progress={uploadProgress}
            highlighted={showSources}
          />
          <StageDoc name="policy.txt" state="ready" highlighted={showSources} />
          <StageDoc name="research_notes.pdf" state="ready" />
        </div>

        {/* Sağ: sahneye göre değişen çalışma alanı */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 218,
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              justifyContent: scene < 2 ? "center" : "flex-start",
            }}
          >
            {scene === 0 && (
              <div
                style={{
                  border: `1.5px dashed ${t.color.borderGlow}`,
                  borderRadius: t.radius.md,
                  background: "rgba(37, 99, 235, 0.06)",
                  padding: "1.1rem 0.9rem",
                  textAlign: "center",
                }}
              >
                <FileUp size={20} color={t.color.primarySoft} />
                <div style={{ fontSize: "0.74rem", color: t.color.text, margin: "0.45rem 0 0.55rem" }}>
                  annual_report.pdf yükleniyor…
                </div>
                <StageProgress value={uploadProgress} />
              </div>
            )}

            {scene === 1 && (
              <div
                style={{
                  ...g.glassPanelSoft,
                  padding: "0.85rem",
                }}
              >
                <div style={{ ...chip, marginBottom: "0.6rem" }}>
                  <Cpu size={12} color={t.color.cyan} /> CHUNK + EMBEDDING
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: "0.3rem",
                  }}
                >
                  {Array.from({ length: CHUNK_CELLS }, (_, i) => (
                    <span
                      key={i}
                      style={{
                        height: 14,
                        borderRadius: t.radius.xs,
                        border: `1px solid ${i < litChunks ? "rgba(96,165,250,0.5)" : t.color.border}`,
                        background:
                          i < litChunks
                            ? "linear-gradient(180deg, rgba(37,99,235,0.55), rgba(34,211,238,0.3))"
                            : "rgba(15, 23, 42, 0.5)",
                        transition: "background 0.25s ease, border-color 0.25s ease",
                      }}
                    />
                  ))}
                </div>
                <div
                  style={{
                    marginTop: "0.6rem",
                    height: 5,
                    borderRadius: 999,
                    background:
                      "linear-gradient(90deg, rgba(37,99,235,0.1), rgba(34,211,238,0.45), rgba(37,99,235,0.1))",
                    backgroundSize: "200% 100%",
                    animation: "ld-shimmer 1.4s linear infinite",
                  }}
                />
                <div style={{ fontSize: "0.68rem", color: t.color.muted, marginTop: "0.5rem" }}>
                  {Math.min(litChunks, CHUNK_CELLS)}/{CHUNK_CELLS} parça vektörleştirildi · ChromaDB
                </div>
              </div>
            )}

            {scene >= 2 && (
              <>
                {showQuestionBubble && (
                  <div style={{ display: "flex", justifyContent: "flex-end" }} className="ld-fade-up">
                    <span
                      style={{
                        maxWidth: "85%",
                        padding: "0.5rem 0.65rem",
                        borderRadius: t.radius.md,
                        fontSize: "0.74rem",
                        lineHeight: 1.5,
                        background: "linear-gradient(180deg, #2f6bff, #2356e6)",
                        color: "#eff6ff",
                        border: "1px solid rgba(96, 165, 250, 0.5)",
                      }}
                    >
                      {DEMO_QUESTION}
                    </span>
                  </div>
                )}

                {answerTyping && (
                  <div style={{ display: "flex", gap: "0.3rem", padding: "0.55rem 0.65rem" }}>
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: t.color.muted,
                          animation: "ld-blink 1.2s infinite both",
                          animationDelay: `${i * 0.18}s`,
                        }}
                      />
                    ))}
                  </div>
                )}

                {typedAnswer && (
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <span
                      style={{
                        maxWidth: "92%",
                        padding: "0.5rem 0.65rem",
                        borderRadius: t.radius.md,
                        fontSize: "0.74rem",
                        lineHeight: 1.55,
                        background: "rgba(30, 41, 59, 0.7)",
                        color: t.color.text,
                        border: `1px solid ${t.color.border}`,
                      }}
                    >
                      {typedAnswer}
                      {scene === 3 && typedAnswer.length < DEMO_ANSWER.length && (
                        <span
                          style={{
                            display: "inline-block",
                            width: 6,
                            height: 12,
                            marginLeft: 2,
                            verticalAlign: "-2px",
                            background: t.color.primarySoft,
                            animation: "ld-caret 0.9s step-end infinite",
                          }}
                        />
                      )}
                    </span>
                  </div>
                )}

                {showSources && (
                  <div
                    className="ld-fade-up"
                    style={{
                      padding: "0.55rem 0.6rem",
                      borderRadius: t.radius.sm,
                      background: "rgba(34, 211, 238, 0.05)",
                      border: "1px solid rgba(34, 211, 238, 0.28)",
                    }}
                  >
                    <div style={{ ...chip, color: t.color.cyan, marginBottom: "0.4rem" }}>
                      <FileText size={11} /> KAYNAKLAR (2)
                    </div>
                    <StageSource text="annual_report.pdf · s. 4" score="%87" delay={0} />
                    <StageSource text="policy.txt · s. 2" score="%74" delay={140} />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sahte giriş çubuğu */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
              padding: "0.5rem 0.6rem",
              borderRadius: t.radius.md,
              background: "rgba(5, 10, 22, 0.6)",
              border: `1px solid ${scene === 2 ? t.color.borderGlow : t.color.borderStrong}`,
              transition: "border-color 0.3s ease",
            }}
          >
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: "0.72rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                color: typedInput ? t.color.text : t.color.subtle,
              }}
            >
              {typedInput || "Dokümanlarınız hakkında bir soru sorun…"}
              {scene === 2 && (
                <span
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 11,
                    marginLeft: 2,
                    verticalAlign: "-2px",
                    background: t.color.primarySoft,
                    animation: "ld-caret 0.9s step-end infinite",
                  }}
                />
              )}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                borderRadius: t.radius.sm,
                background:
                  scene === 2
                    ? "linear-gradient(180deg, #2f6bff, #2356e6)"
                    : "rgba(37, 99, 235, 0.25)",
                transition: "background 0.3s ease",
              }}
            >
              <SendHorizontal size={12} color="#eff6ff" />
            </span>
          </div>
        </div>
      </div>

      {/* Sahne zaman çizelgesi */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <div style={{ display: "flex", gap: "0.3rem" }}>
          {SCENE_LABELS.map((label, i) => (
            <span
              key={label}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 999,
                background: "rgba(148, 163, 184, 0.18)",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  display: "block",
                  height: "100%",
                  borderRadius: 999,
                  background: "linear-gradient(90deg, #2f6bff, #22d3ee)",
                  transformOrigin: "left",
                  transform: `scaleX(${i < scene ? 1 : i === scene ? local / FRAMES_PER_SCENE : 0})`,
                  transition: "transform 0.1s linear",
                }}
              />
            </span>
          ))}
        </div>
        <span style={{ fontSize: "0.68rem", color: t.color.muted, display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <Sparkles size={11} color={t.color.primarySoft} />
          {SCENE_LABELS[scene]}
        </span>
      </div>

      {/* Sahneler arasında süzülen imleç */}
      {!reduced && (
        <span
          style={{
            position: "absolute",
            top: CURSOR_POS[scene].top,
            left: CURSOR_POS[scene].left,
            zIndex: 3,
            pointerEvents: "none",
            transition: "top 1s cubic-bezier(0.22, 0.61, 0.36, 1), left 1s cubic-bezier(0.22, 0.61, 0.36, 1)",
            filter: "drop-shadow(0 2px 6px rgba(2, 6, 16, 0.7))",
          }}
        >
          <MousePointer2 size={15} color="#e2e8f0" />
        </span>
      )}
    </div>
  );
}

function StageDot({ color }: { color: string }) {
  return (
    <span
      style={{
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: color,
        display: "inline-block",
      }}
    />
  );
}

function StageProgress({ value }: { value: number }) {
  return (
    <span
      style={{
        display: "block",
        height: 4,
        borderRadius: 999,
        background: "rgba(148, 163, 184, 0.18)",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          display: "block",
          height: "100%",
          width: `${Math.round(value * 100)}%`,
          borderRadius: 999,
          background: "linear-gradient(90deg, #2f6bff, #22d3ee)",
          transition: "width 0.15s linear",
        }}
      />
    </span>
  );
}

function StageDoc({
  name,
  state,
  progress = 1,
  highlighted = false,
}: {
  name: string;
  state: "uploading" | "processing" | "ready";
  progress?: number;
  highlighted?: boolean;
}) {
  const stateMeta =
    state === "ready"
      ? { label: "hazır", color: t.color.emerald }
      : state === "processing"
        ? { label: "işleniyor", color: t.color.amber }
        : { label: "yükleniyor", color: t.color.primarySoft };

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: "0.3rem",
        padding: "0.45rem 0.5rem",
        borderRadius: t.radius.sm,
        background: "rgba(15, 23, 42, 0.45)",
        border: `1px solid ${highlighted ? "rgba(34, 211, 238, 0.45)" : t.color.border}`,
        opacity: state === "uploading" ? 0.55 + progress * 0.45 : 1,
        transition: "border-color 0.3s ease, opacity 0.2s linear",
      }}
    >
      {/* İşleme sırasında kartın üzerinden geçen tarama ışığı */}
      {state === "processing" && (
        <span
          style={{
            position: "absolute",
            inset: "0 0 auto 0",
            height: "38%",
            background:
              "linear-gradient(180deg, transparent, rgba(34, 211, 238, 0.14), transparent)",
            animation: "ld-scanline 1.6s linear infinite",
            pointerEvents: "none",
          }}
        />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", minWidth: 0 }}>
        <FileText size={13} color={highlighted ? t.color.cyan : t.color.muted} />
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
      </div>
      {state === "uploading" ? (
        <StageProgress value={progress} />
      ) : (
        <span
          style={{
            fontSize: "0.6rem",
            fontWeight: 700,
            color: stateMeta.color,
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
              background: stateMeta.color,
              animation:
                state === "processing" ? "ld-pulse 1.4s ease-in-out infinite" : undefined,
            }}
          />
          {stateMeta.label}
        </span>
      )}
    </div>
  );
}

function StageSource({ text, score, delay }: { text: string; score: string; delay: number }) {
  return (
    <div
      className="ld-fade-up"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.4rem",
        padding: "0.18rem 0",
        animationDelay: `${delay}ms`,
      }}
    >
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: t.color.cyan }} />
      <span style={{ flex: 1, fontSize: "0.68rem", color: t.color.muted }}>{text}</span>
      <span style={{ fontSize: "0.62rem", fontWeight: 700, color: t.color.cyan }}>{score}</span>
    </div>
  );
}

// =============================================================
// Sayfa
// =============================================================

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

  // Hero mockup için hafif parallax (scroll ile aşağı süzülür).
  const stageWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stageWrapRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = Math.min(window.scrollY * 0.07, 46);
        el.style.transform = `translateY(${y}px)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const deniedAlert = accessDenied ? (
    <div style={g.alertWarning} className="ld-fade-in ld-glass-soft" role="alert">
      <Shield size={16} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>Bu sayfaya erişim yetkiniz yok; ana sayfaya yönlendirildiniz.</span>
    </div>
  ) : null;

  return (
    <div ref={shellRef} style={{ ...g.pageShell, overflow: "hidden" }}>
      {/* Mouse'u takip eden, mavi–cyan tonlarında ışıyan arka plan katmanı */}
      <div className="ld-cursor-glow" aria-hidden="true" />

      {/* Üst navigasyon */}
      <header style={g.nav} className="ld-glass">
        <nav
          className="ld-nav-inner"
          style={{
            ...g.container,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            padding: "0.7rem 1.25rem",
          }}
        >
          <Link href="/" style={g.brand}>
            <span style={g.brandMark}>
              <Database size={16} />
            </span>
            LocalDoc <span style={{ color: t.color.primarySoft }}>AI</span>
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
                style={{ ...g.dangerButton, padding: "0.5rem 0.85rem", fontSize: "0.82rem" }}
              >
                Çıkış Yap
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Link
                href="/login"
                className="ld-btn"
                style={{ ...g.ghostButton, padding: "0.5rem 0.95rem", fontSize: "0.85rem" }}
              >
                Giriş Yap
              </Link>
              <Link
                href="/register"
                className="ld-btn"
                style={{ ...g.glassButton, padding: "0.5rem 0.95rem", fontSize: "0.85rem" }}
              >
                Kayıt Ol
              </Link>
            </div>
          )}
        </nav>
      </header>

      {loading ? (
        <div
          style={{
            ...g.container,
            position: "relative",
            zIndex: 1,
            padding: "5rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            color: t.color.muted,
          }}
        >
          <Spinner /> Yükleniyor...
        </div>
      ) : isAuthenticated ? (
        /* ---------- Giriş yapmış kullanıcı: dashboard giriş alanı ---------- */
        <main
          style={{ ...g.container, position: "relative", zIndex: 1, padding: "2.5rem 1.25rem 4rem" }}
          className="ld-fade-in"
        >
          {deniedAlert && <div style={{ marginBottom: "1.5rem" }}>{deniedAlert}</div>}

          <section style={{ ...g.glassPanel, padding: "1.75rem" }} className="ld-glass">
            <span style={g.kicker}>
              <CheckCircle2 size={13} /> Oturum aktif
            </span>
            <h1 style={{ ...g.sectionTitle, margin: "0.9rem 0 0.4rem", fontSize: "1.7rem" }}>
              Hoş geldin,{" "}
              <span style={{ color: t.color.primarySoft, wordBreak: "break-all" }}>
                {user?.email}
              </span>
              {isAdmin ? (
                <span style={{ color: t.color.amber, fontSize: "0.95rem" }}> · admin</span>
              ) : null}
            </h1>
            <p style={{ ...g.sectionLead, marginBottom: "1.5rem" }}>
              Doküman bilgi tabanınla çalışmaya devam et. Hızlı aksiyonlarla soru sor,
              yeni doküman yükle veya mevcut dokümanlarını yönet.
            </p>

            <div className="ld-actions">
              {QUICK_ACTIONS.map(({ icon: ActIcon, label, desc, href }) => (
                <Link key={href} href={href} className="ld-hover-card" style={g.actionCard}>
                  <span style={g.iconWrap}>
                    <ActIcon size={19} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 600, fontSize: "0.92rem" }}>
                      {label}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.78rem",
                        color: t.color.muted,
                        marginTop: "0.15rem",
                      }}
                    >
                      {desc}
                    </span>
                  </span>
                  <ArrowRight size={16} color={t.color.subtle} />
                </Link>
              ))}

              {isAdmin && (
                <Link
                  href="/admin"
                  className="ld-hover-card"
                  style={{ ...g.actionCard, border: "1px solid rgba(251, 191, 36, 0.3)" }}
                >
                  <span
                    style={{
                      ...g.iconWrap,
                      background: "rgba(251, 191, 36, 0.12)",
                      border: "1px solid rgba(251, 191, 36, 0.25)",
                      color: t.color.amber,
                    }}
                  >
                    <Shield size={19} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 600, fontSize: "0.92rem" }}>
                      Admin Paneli
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.78rem",
                        color: t.color.muted,
                        marginTop: "0.15rem",
                      }}
                    >
                      Kullanıcı ve doküman yönetimi
                    </span>
                  </span>
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
          <section style={{ ...g.container, padding: "3.25rem 1.25rem 1.5rem" }}>
            {deniedAlert && <div style={{ marginBottom: "1.75rem" }}>{deniedAlert}</div>}

            <div className="ld-hero">
              <div className="ld-fade-up">
                <span style={g.kicker}>
                  <ShieldCheck size={13} /> Lokal · Gizli · Kaynaklı
                </span>
                <h1
                  className="ld-hero-title"
                  style={{
                    margin: "1.1rem 0 1rem",
                    fontSize: "2.55rem",
                    lineHeight: 1.14,
                    letterSpacing: "-1px",
                    color: t.color.heading,
                  }}
                >
                  Dokümanlarınızla{" "}
                  <span
                    style={{
                      background: "linear-gradient(90deg, #60a5fa, #22d3ee)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    lokal ve güvenli
                  </span>{" "}
                  AI sohbeti
                </h1>
                <p style={{ ...g.sectionLead, fontSize: "1.02rem", marginBottom: "1.6rem" }}>
                  LocalDoc AI; PDF ve TXT dokümanlarınızı tamamen lokal ortamda işler,
                  semantik arama ile ilgili bölümleri bulur ve her cevabı dosya adı ile
                  sayfa referansı vererek üretir. Verileriniz makinenizden çıkmaz.
                </p>

                <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", marginBottom: "1.6rem" }}>
                  <Link href="/register" className="ld-btn" style={g.glassButton}>
                    Kayıt Ol <ArrowRight size={16} />
                  </Link>
                  <Link href="/login" className="ld-btn" style={g.ghostButton}>
                    Giriş Yap
                  </Link>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {TRUST_BADGES.map(({ icon: BadgeIcon, label }) => (
                    <span key={label} style={g.badge} className="ld-glass-soft">
                      <BadgeIcon size={13} color={t.color.primarySoft} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div ref={stageWrapRef} className="ld-fade-up" style={{ animationDelay: "120ms" }}>
                <PromoStage />
              </div>
            </div>
          </section>

          {/* Güvenlik / value props */}
          <section style={{ ...g.container, padding: "4rem 1.25rem 1rem" }}>
            <Reveal variant="blur">
              <span style={g.kicker}>
                <Lock size={13} /> Güvenlik ve gizlilik
              </span>
              <h2 style={{ ...g.sectionTitle, marginTop: "0.9rem" }}>
                Verileriniz sizde kalır, cevaplar kanıtıyla gelir
              </h2>
              <p style={{ ...g.sectionLead, marginBottom: "1.75rem" }}>
                Gizliliği, kaynaklı cevapları ve çok kullanıcılı yapıyı bir araya getiren
                lokal doküman zekası.
              </p>
            </Reveal>

            <div className="ld-features">
              {FEATURES.map(({ icon: FeatIcon, title, desc }, i) => (
                <Reveal key={title} delay={i * 90} style={{ height: "100%" }}>
                  <div
                    className="ld-glass ld-hover-card"
                    style={{ ...g.glassPanel, padding: "1.4rem", height: "100%" }}
                  >
                    <span style={g.iconWrap}>
                      <FeatIcon size={19} />
                    </span>
                    <h3 style={{ margin: "0.9rem 0 0.4rem", fontSize: "1.02rem", color: t.color.heading }}>
                      {title}
                    </h3>
                    <p style={{ margin: 0, fontSize: "0.87rem", lineHeight: 1.6, color: t.color.muted }}>
                      {desc}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* Çalışma akışı */}
          <section style={{ ...g.container, padding: "4rem 1.25rem 1rem" }}>
            <div className="ld-flow">
              <div className="ld-flow-intro">
                <Reveal variant="blur">
                  <span style={g.kicker}>
                    <Search size={13} /> Nasıl çalışır
                  </span>
                  <h2 style={{ ...g.sectionTitle, marginTop: "0.9rem" }}>
                    Yüklemeden kaynaklı cevaba beş adım
                  </h2>
                  <p style={g.sectionLead}>
                    Doküman işleme hattının tamamı — metin çıkarma, parçalama, embedding
                    ve retrieval — kendi ortamınızda çalışır. Hiçbir adımda dış servis
                    devreye girmez.
                  </p>
                </Reveal>
              </div>

              <div className="ld-flow-steps">
                {FLOW_STEPS.map(({ icon: StepIcon, title, desc }, i) => (
                  <Reveal key={title} variant="right" delay={i * 70}>
                    <div
                      className="ld-glass ld-hover-card"
                      style={{
                        ...g.glassPanel,
                        padding: "1.1rem",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.85rem",
                      }}
                    >
                      <span style={{ ...g.iconWrap, width: 36, height: 36, position: "relative" }}>
                        <StepIcon size={17} />
                        <span
                          style={{
                            position: "absolute",
                            top: -7,
                            left: -7,
                            width: 18,
                            height: 18,
                            borderRadius: t.radius.sm,
                            background: t.color.primary,
                            color: "#fff",
                            fontSize: "0.62rem",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1px solid rgba(96, 165, 250, 0.6)",
                          }}
                        >
                          {i + 1}
                        </span>
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: "0.92rem",
                            fontWeight: 600,
                            color: t.color.heading,
                          }}
                        >
                          {title}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "0.82rem",
                            lineHeight: 1.55,
                            color: t.color.muted,
                            marginTop: "0.25rem",
                          }}
                        >
                          {desc}
                        </span>
                      </span>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* Kullanım senaryoları */}
          <section style={{ ...g.container, padding: "4rem 1.25rem 1rem" }}>
            <Reveal variant="blur">
              <span style={g.kicker}>
                <Sparkles size={13} /> Kullanım senaryoları
              </span>
              <h2 style={{ ...g.sectionTitle, marginTop: "0.9rem" }}>
                Doküman yoğun her iş akışına uyar
              </h2>
            </Reveal>

            <div className="ld-usecases" style={{ marginTop: "1.75rem" }}>
              {USE_CASES.map(({ icon: CaseIcon, title, desc }, i) => (
                <Reveal key={title} delay={i * 100} style={{ height: "100%" }}>
                  <div
                    className="ld-glass ld-hover-card"
                    style={{ ...g.glassPanel, padding: "1.4rem", height: "100%" }}
                  >
                    <span style={{ ...g.iconWrap, color: t.color.cyan, background: "rgba(34, 211, 238, 0.1)", border: "1px solid rgba(34, 211, 238, 0.22)" }}>
                      <CaseIcon size={19} />
                    </span>
                    <h3 style={{ margin: "0.9rem 0 0.4rem", fontSize: "1.02rem", color: t.color.heading }}>
                      {title}
                    </h3>
                    <p style={{ margin: 0, fontSize: "0.87rem", lineHeight: 1.6, color: t.color.muted }}>
                      {desc}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* Alt CTA */}
          <section style={{ ...g.container, padding: "4rem 1.25rem 4.5rem" }}>
            <Reveal variant="blur">
              <div
                className="ld-glass-strong"
                style={{
                  ...g.glassPanel,
                  padding: "2.75rem 1.75rem",
                  textAlign: "center",
                  background:
                    "radial-gradient(620px 240px at 50% 0%, rgba(37, 99, 235, 0.2), transparent 70%)," +
                    t.color.surfaceStrong,
                }}
              >
                <h2 style={{ ...g.sectionTitle, margin: "0 auto 0.7rem", maxWidth: 560 }}>
                  Kendi doküman bilgi tabanınızı lokal olarak başlatın
                </h2>
                <p style={{ ...g.sectionLead, margin: "0 auto 1.6rem" }}>
                  Birkaç dakikada hesabınızı oluşturun, dokümanlarınızı yükleyin ve
                  kaynaklı cevaplar almaya başlayın.
                </p>
                <div style={{ display: "flex", gap: "0.7rem", justifyContent: "center", flexWrap: "wrap" }}>
                  <Link href="/register" className="ld-btn" style={g.glassButton}>
                    Kayıt Ol <ArrowRight size={16} />
                  </Link>
                  <Link href="/login" className="ld-btn" style={g.ghostButton}>
                    Giriş Yap
                  </Link>
                </div>
              </div>
            </Reveal>
          </section>

          {/* Footer */}
          <footer
            style={{
              borderTop: `1px solid ${t.color.border}`,
              padding: "1.5rem 1.25rem",
            }}
          >
            <div
              style={{
                ...g.container,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                flexWrap: "wrap",
                fontSize: "0.8rem",
                color: t.color.subtle,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
                <Database size={14} color={t.color.primarySoft} />
                LocalDoc AI — lokal RAG doküman asistanı
              </span>
              <span>Verileriniz makinenizden çıkmaz.</span>
            </div>
          </footer>
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
              rgba(37, 99, 235, 0.2),
              transparent 60%
            ),
            radial-gradient(
              900px circle at var(--ld-mx, 50%) var(--ld-my, 26%),
              rgba(34, 211, 238, 0.09),
              transparent 55%
            );
          transition: background 0.12s ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .ld-cursor-glow {
            transition: none;
          }
        }

        .ld-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
          gap: 2.5rem;
          align-items: center;
        }
        .ld-actions {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 0.85rem;
        }
        .ld-features,
        .ld-usecases {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 1rem;
        }
        .ld-flow {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
          gap: 2.5rem;
          align-items: start;
        }
        .ld-flow-intro {
          position: sticky;
          top: 92px;
        }
        .ld-flow-steps {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        @media (max-width: 880px) {
          .ld-hero {
            grid-template-columns: 1fr;
            gap: 1.75rem;
          }
          .ld-hero-title {
            font-size: 2.1rem !important;
          }
          .ld-flow {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }
          .ld-flow-intro {
            position: static;
          }
        }

        @media (max-width: 560px) {
          .ld-hero-title {
            font-size: 1.85rem !important;
          }
          .ld-nav-email {
            display: none;
          }
        }
      `}</style>
      <style jsx global>{`
        @media (max-width: 560px) {
          .ld-mock-body {
            flex-direction: column;
          }
          .ld-mock-docs {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
