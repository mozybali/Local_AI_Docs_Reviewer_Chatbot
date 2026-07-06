import Link from "next/link";
import Head from "next/head";
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
import ThemeToggle from "../components/ThemeToggle";

type Icon = ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;

// --- Statik içerik tanımları (tek kaynaktan yönetilir) ---

const TRUST_BADGES: { icon: Icon; label: string }[] = [
  { icon: ShieldCheck, label: "Kurum içi AI" },
  { icon: Lock, label: "Hassas veri kontrolü" },
  { icon: FileText, label: "Sayfa kaynaklı cevap" },
  { icon: Users, label: "Kullanıcı bazlı erişim" },
  { icon: CheckCircle2, label: "Admin görünürlüğü" },
];

const FEATURES: { icon: Icon; title: string; desc: string }[] = [
  {
    icon: FileSearch,
    title: "Bilgiye daha hızlı ulaşın",
    desc: "Uzun sözleşme, rapor, politika ve prosedürlerde aranan maddeyi doğal dille bulun; ekipler arama için zaman kaybetmez.",
  },
  {
    icon: ShieldCheck,
    title: "Denetlenebilir cevaplar alın",
    desc: "Her yanıt dosya adı, sayfa bilgisi ve benzerlik skoruyla gelir; kararın hangi kaynağa dayandığı açık kalır.",
  },
  {
    icon: Lock,
    title: "Veriyi kurum içinde tutun",
    desc: "Doküman içeriği dış AI servislerine gönderilmeden, uçtan uca kurum içi altyapıda işlenir ve saklanır.",
  },
  {
    icon: Users,
    title: "Ekip erişimini kontrol edin",
    desc: "Kurumsal kimlik doğrulama, kullanıcı bazlı izolasyon ve admin görünürlüğüyle hassas dokümanlara erişim kontrollü yönetilir.",
  },
];

const FLOW_STEPS: { icon: Icon; title: string; desc: string }[] = [
  {
    icon: UploadCloud,
    title: "Kurumsal dokümanları yükleyin",
    desc: "PDF, TXT ve DOCX dosyalarınız güvenli şekilde alınır, kullanıcı hesabınıza bağlı olarak işlenir.",
  },
  {
    icon: FileText,
    title: "İçerik aranabilir hale gelir",
    desc: "Metin çıkarılır, anlamlı bölümlere ayrılır ve sayfa bilgisi korunarak bilgi tabanına hazırlanır.",
  },
  {
    icon: Layers,
    title: "AI bilgi tabanı oluşur",
    desc: "İçerik anlamsal aramaya hazır hale getirilir; tüm işlem kurum içinde, doküman sahibiyle izole biçimde yapılır.",
  },
  {
    icon: MessageSquare,
    title: "Ekipler doğal dille sorar",
    desc: "Kullanıcılar teknik arama operatörleri bilmeden; politika, rapor veya sözleşme hakkında doğrudan soru sorar.",
  },
  {
    icon: CheckCircle2,
    title: "Cevap kanıtlarıyla paylaşılır",
    desc: "Lokal model yalnızca getirilen bağlama dayanır; kaynak bulunamazsa bunu açıkça belirtir.",
  },
];

const USE_CASES: { icon: Icon; title: string; desc: string }[] = [
  {
    icon: Building2,
    title: "Operasyon ve kalite ekipleri",
    desc: "Prosedür, talimat ve kalite dokümanlarında doğru maddeye hızla ulaşarak saha kararlarını standartlaştırın.",
  },
  {
    icon: FileSearch,
    title: "Hukuk, sözleşme ve uyumluluk",
    desc: "Sözleşme yükümlülüklerini, regülasyon maddelerini ve iç politika referanslarını kaynaklarıyla kontrol edin.",
  },
  {
    icon: BookOpen,
    title: "Yönetim raporları ve iç bilgi",
    desc: "Rapor, toplantı notu ve kurumsal bilgi dokümanlarını yöneticiler için sorgulanabilir bir karar desteğine dönüştürün.",
  },
];

const CUSTOMER_OUTCOMES: { value: string; label: string; desc: string }[] = [
  {
    value: "Tek merkez",
    label: "Kurumsal bilgi erişimi",
    desc: "Dağınık dosyaları tek bir güvenli soru-cevap deneyiminde toplayın.",
  },
  {
    value: "Kaynaklı",
    label: "Denetlenebilir karar desteği",
    desc: "Yanıtların dayandığı doküman ve sayfa bilgisini anında görün.",
  },
  {
    value: "Lokal",
    label: "Veri egemenliği",
    desc: "Hassas içerikleri dış AI servislerine göndermeden çalışın.",
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
  "İçerik güvenli biçimde indeksleniyor",
  "Kullanıcı soru soruyor",
  "AI kaynaklara dayanarak yanıtlıyor",
  "Kaynak paneli inceleniyor",
] as const;

const SCENE_COUNT = SCENE_LABELS.length;
const FRAMES_PER_SCENE = 44; // 44 kare × 80ms ≈ 3.5sn / sahne
const TICK_MS = 80;
const TOTAL_FRAMES = SCENE_COUNT * FRAMES_PER_SCENE;

const DEMO_QUESTION = "Sözleşmedeki ana teslimat riski nedir?";
const DEMO_ANSWER =
  "Ana risk, gecikme durumunda uygulanacak cezalar ve tek tedarikçiye bağımlılık olarak belirtilmiş (s. 12).";

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
          <StageDot color={t.color.danger} />
          <StageDot color={t.color.amber} />
          <StageDot color={t.color.emerald} />
        </span>
        <span style={{ fontSize: "0.72rem", color: t.color.subtle, marginLeft: "0.3rem" }}>
          LocalDoc AI — kurumsal çalışma alanı
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
          ÜRÜN TURU
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
            name="tedarik_sozlesmesi.pdf"
            state={docState}
            progress={uploadProgress}
            highlighted={showSources}
          />
          <StageDoc name="bilgi_guvenligi_politikasi.docx" state="ready" highlighted={showSources} />
          <StageDoc name="yonetim_raporu.pdf" state="ready" />
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
                  background: "var(--ld-primary-tint)",
                  padding: "1.1rem 0.9rem",
                  textAlign: "center",
                }}
              >
                <FileUp size={20} color={t.color.primarySoft} />
                <div style={{ fontSize: "0.74rem", color: t.color.text, margin: "0.45rem 0 0.55rem" }}>
                  tedarik_sozlesmesi.pdf yükleniyor…
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
                  <Cpu size={12} color={t.color.cyan} /> GÜVENLİ İNDEKSLEME
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
                        border: `1px solid ${i < litChunks ? "var(--ld-primary-border)" : t.color.border}`,
                        background: i < litChunks ? t.color.primary : t.color.glassSoft,
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
                      "linear-gradient(90deg, var(--ld-primary-tint), var(--ld-primary), var(--ld-primary-tint))",
                    backgroundSize: "200% 100%",
                    animation: "ld-shimmer 1.4s linear infinite",
                  }}
                />
                <div style={{ fontSize: "0.68rem", color: t.color.muted, marginTop: "0.5rem" }}>
                  {Math.min(litChunks, CHUNK_CELLS)}/{CHUNK_CELLS} bölüm güvenli arama için hazırlandı
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
                        background: t.color.userBubble,
                        color: t.color.userBubbleText,
                        border: `1px solid ${t.color.userBubbleBorder}`,
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
                        background: t.color.glassSoft,
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
                      background: "var(--ld-info-bg)",
                      border: "1px solid var(--ld-info-border)",
                    }}
                  >
                    <div style={{ ...chip, color: t.color.cyan, marginBottom: "0.4rem" }}>
                      <FileText size={11} /> KAYNAKLAR (2)
                    </div>
                    <StageSource text="tedarik_sozlesmesi.pdf · s. 12" score="%87" delay={0} />
                    <StageSource text="bilgi_guvenligi_politikasi.docx · s. 3" score="%74" delay={140} />
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
              background: t.color.glassSoft,
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
                background: scene === 2 ? t.color.primary : "var(--ld-primary-tint-strong)",
                transition: "background 0.3s ease",
              }}
            >
              <SendHorizontal size={12} color={scene === 2 ? t.color.onPrimary : t.color.primary} />
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
                background: "var(--ld-border-strong)",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  display: "block",
                  height: "100%",
                  borderRadius: 999,
                  background: "linear-gradient(90deg, var(--ld-primary), var(--ld-info))",
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
            filter: "drop-shadow(0 2px 6px rgba(0, 0, 0, 0.35))",
          }}
        >
          <MousePointer2 size={15} color={t.color.text} />
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
        background: "var(--ld-border-strong)",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          display: "block",
          height: "100%",
          width: `${Math.round(value * 100)}%`,
          borderRadius: 999,
          background: "linear-gradient(90deg, var(--ld-primary), var(--ld-info))",
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
        background: t.color.glassSoft,
        border: `1px solid ${highlighted ? "var(--ld-info-border)" : t.color.border}`,
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
              "linear-gradient(180deg, transparent, var(--ld-info-bg), transparent)",
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
      <Head>
        <title>LocalDoc AI | Kurumsal Lokal Doküman Asistanı</title>
        <meta
          name="description"
          content="LocalDoc AI, şirket dokümanlarını lokal ortamda işleyen, kaynaklı ve güvenli AI doküman asistanıdır."
        />
      </Head>

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
              <ThemeToggle />
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
              <ThemeToggle />
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
                Hesap Oluştur
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
                  style={{ ...g.actionCard, border: "1px solid var(--ld-warning-border)" }}
                >
                  <span
                    style={{
                      ...g.iconWrap,
                      background: "var(--ld-warning-bg)",
                      border: "1px solid var(--ld-warning-border)",
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
                  <ShieldCheck size={13} /> Kurumsal doküman asistanı
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
                  Şirket dokümanlarınızı{" "}
                  <span
                    style={{
                      background: "linear-gradient(90deg, var(--ld-primary), var(--ld-info))",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    güvenli AI bilgi merkezine
                  </span>{" "}
                  dönüştürün
                </h1>
                <p style={{ ...g.sectionLead, fontSize: "1.02rem", marginBottom: "1.6rem" }}>
                  LocalDoc AI; sözleşme, rapor, politika ve teknik dokümanlarınızı
                  kurum içinde işler. Ekipler doğal dille soru sorar, cevaplar
                  dosya ve sayfa referansıyla gelir; hassas veriler dış AI
                  servislerine taşınmadan karar süreçleri hızlanır.
                </p>

                <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", marginBottom: "1.6rem" }}>
                  <Link href="/register" className="ld-btn" style={g.glassButton}>
                    Hesap Oluştur <ArrowRight size={16} />
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

                <div className="ld-outcome-strip">
                  {CUSTOMER_OUTCOMES.map((item) => (
                    <div key={item.label} className="ld-glass-soft" style={g.glassPanelSoft}>
                      <strong>{item.value}</strong>
                      <span>{item.label}</span>
                      <p>{item.desc}</p>
                    </div>
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
                <Lock size={13} /> Müşteri değeri
              </span>
              <h2 style={{ ...g.sectionTitle, marginTop: "0.9rem" }}>
                Bilgi aramayı güvenli karar desteğine dönüştürün
              </h2>
              <p style={{ ...g.sectionLead, marginBottom: "1.75rem" }}>
                LocalDoc AI, doküman yoğun ekiplerin aradığı cevaba daha hızlı
                ulaşmasını sağlar; aynı zamanda gizlilik, kaynak doğrulama ve
                yetkili erişim ihtiyaçlarını birlikte ele alır.
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
                    <Search size={13} /> Uygulama akışı
                  </span>
                  <h2 style={{ ...g.sectionTitle, marginTop: "0.9rem" }}>
                    İlk dokümandan kaynaklı cevaba beş adım
                  </h2>
                  <p style={g.sectionLead}>
                    Kurulumdan sonra ekipleriniz mevcut dokümanlarla çalışmaya
                    başlar. Sistem arka planda metni hazırlar, ilgili kaynakları
                    bulur ve cevabı denetlenebilir biçimde sunar.
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
                            color: t.color.onPrimary,
                            fontSize: "0.62rem",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1px solid var(--ld-primary-border)",
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
                Doküman yoğun ekipler için pratik kullanım alanları
              </h2>
              <p style={g.sectionLead}>
                Müşteri destekten yönetime, hukuk ekiplerinden kalite süreçlerine
                kadar kritik bilginin kaynağıyla birlikte bulunması gereken her
                iş akışında kullanılabilir.
              </p>
            </Reveal>

            <div className="ld-usecases" style={{ marginTop: "1.75rem" }}>
              {USE_CASES.map(({ icon: CaseIcon, title, desc }, i) => (
                <Reveal key={title} delay={i * 100} style={{ height: "100%" }}>
                  <div
                    className="ld-glass ld-hover-card"
                    style={{ ...g.glassPanel, padding: "1.4rem", height: "100%" }}
                  >
                    <span style={{ ...g.iconWrap, color: t.color.cyan, background: "var(--ld-info-bg)", border: "1px solid var(--ld-info-border)" }}>
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
                    "radial-gradient(620px 240px at 50% 0%, var(--ld-primary-tint-strong), transparent 70%)," +
                    t.color.surface,
                }}
              >
                <h2 style={{ ...g.sectionTitle, margin: "0 auto 0.7rem", maxWidth: 560 }}>
                  Kurum içi doküman zekasını bugün deneyin
                </h2>
                <p style={{ ...g.sectionLead, margin: "0 auto 1.6rem" }}>
                  Hesabınızı oluşturun, ilk dokümanlarınızı yükleyin ve ekiplerinizin
                  kaynaklı cevaplarla nasıl daha hızlı ilerlediğini görün.
                </p>
                <div style={{ display: "flex", gap: "0.7rem", justifyContent: "center", flexWrap: "wrap" }}>
                  <Link href="/register" className="ld-btn" style={g.glassButton}>
                    Hesap Oluştur <ArrowRight size={16} />
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
                LocalDoc AI — kurumsal lokal doküman asistanı
              </span>
              <span>Kaynaklı cevaplar, kontrollü erişim, kurum içi veri işleme.</span>
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
              var(--ld-glow-b),
              transparent 60%
            ),
            radial-gradient(
              900px circle at var(--ld-mx, 50%) var(--ld-my, 26%),
              var(--ld-glow-a),
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
        .ld-outcome-strip {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.65rem;
          margin-top: 1.15rem;
        }
        .ld-outcome-strip > div {
          min-height: 118px;
          padding: 0.85rem;
          display: flex;
          flex-direction: column;
          gap: 0.28rem;
        }
        .ld-outcome-strip strong {
          color: var(--ld-text);
          font-size: 0.95rem;
          line-height: 1.2;
        }
        .ld-outcome-strip span {
          color: var(--ld-primary);
          font-size: 0.76rem;
          font-weight: 700;
          line-height: 1.35;
        }
        .ld-outcome-strip p {
          margin: 0;
          color: var(--ld-text-muted);
          font-size: 0.74rem;
          line-height: 1.5;
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
          .ld-outcome-strip {
            grid-template-columns: 1fr;
          }
          .ld-outcome-strip > div {
            min-height: 0;
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
