import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { AuthProvider } from "../context/AuthContext";

// Geçiş perdesinin durumu: rota değişimi başlayınca ekran "cover" ile
// kapanır, yeni sayfa hazır olunca "reveal" ile açılır ve katman kaldırılır.
type VeilPhase = "idle" | "cover" | "reveal";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  // Sayfalar arası geçişte üstte akan ince ilerleme çubuğu.
  const [navigating, setNavigating] = useState(false);
  const [veil, setVeil] = useState<VeilPhase>("idle");

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const start = (_url: string, { shallow }: { shallow: boolean }) => {
      if (shallow) return;
      setNavigating(true);
      // Hareket azaltma tercihinde perde efekti atlanır; çubuk yeterli sinyal.
      if (!reduceMotion.matches) setVeil("cover");
      // Rota değişimindeki otomatik en-üste kaydırma perde altında anında
      // gerçekleşsin; sayfa içi smooth scroll etkilenmez (aşağıda geri alınır).
      document.documentElement.style.scrollBehavior = "auto";
    };
    const end = () => {
      setNavigating(false);
      setVeil((v) => (v === "cover" ? "reveal" : v));
      requestAnimationFrame(() => {
        document.documentElement.style.scrollBehavior = "";
      });
    };
    router.events.on("routeChangeStart", start);
    router.events.on("routeChangeComplete", end);
    router.events.on("routeChangeError", end);
    return () => {
      router.events.off("routeChangeStart", start);
      router.events.off("routeChangeComplete", end);
      router.events.off("routeChangeError", end);
    };
  }, [router.events]);

  return (
    <AuthProvider>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <title>LocalDoc AI</title>
      </Head>
      {navigating && <div className="ld-route-progress" aria-hidden="true" />}
      {/* Geçiş perdesi: eski sayfanın üzerine kapanır, yeni sayfa mount
          olduktan sonra açılarak yumuşak bir cross-fade hissi verir. */}
      {veil !== "idle" && (
        <div
          className={`ld-route-veil ${veil === "cover" ? "is-cover" : "is-reveal"}`}
          aria-hidden="true"
          onAnimationEnd={() =>
            setVeil((v) => (v === "reveal" ? "idle" : v))
          }
        />
      )}
      {/* key=pathname: her rota değişiminde sarmalayıcı yeniden mount olur ve
          giriş animasyonu tekrarlanır (sayfalar arası geçiş animasyonu). */}
      <div key={router.pathname} className="ld-route-transition">
        <Component {...pageProps} />
      </div>
      <style jsx global>{`
        /* =====================================================
           Renk paleti — aydınlık mod (varsayılan)
           ===================================================== */
        :root {
          color-scheme: light;
          --ld-bg: #f7f8fa; /* ana arka plan */
          --ld-surface: #ffffff; /* ana yüzey / kart */
          --ld-surface-2: #f1f4f8; /* ikincil yüzey */
          --ld-text: #172033; /* ana metin */
          --ld-text-muted: #5d667a; /* ikincil metin */
          --ld-border: #d9dee7; /* ince border */
          --ld-border-strong: #c7cfdc;
          --ld-primary: #315bea; /* primary / CTA */
          --ld-primary-hover: #284cc5;
          --ld-primary-rgb: 49, 91, 234;
          --ld-on-primary: #ffffff;
          --ld-primary-tint: rgba(49, 91, 234, 0.08);
          --ld-primary-tint-strong: rgba(49, 91, 234, 0.14);
          --ld-primary-border: rgba(49, 91, 234, 0.3);
          --ld-user-bubble: #eaf0ff; /* kullanıcı sohbet balonu */
          --ld-user-bubble-text: #172033;
          --ld-user-bubble-border: #d4e0fa;
          --ld-assistant-bubble: #ffffff; /* asistan sohbet balonu */
          --ld-code-bg: #eef1f5; /* kod bloğu */
          --ld-focus-ring: #6d8cff; /* erişilebilir odak halkası */
          --ld-focus-shadow: 0 0 0 3px rgba(109, 140, 255, 0.3);
          --ld-nav-bg: rgba(255, 255, 255, 0.85);
          --ld-backdrop: rgba(23, 32, 51, 0.45);
          --ld-selection: rgba(49, 91, 234, 0.22);
          --ld-scrollbar: rgba(93, 102, 122, 0.45);
          --ld-scrollbar-hover: rgba(93, 102, 122, 0.65);
          --ld-grid-line: rgba(23, 32, 51, 0.04);
          --ld-glow-a: rgba(49, 91, 234, 0.07);
          --ld-glow-b: rgba(109, 140, 255, 0.06);
          --ld-veil: rgba(247, 248, 250, 0.92);
          --ld-hover-filter: brightness(0.96);
          --ld-shadow-panel: 0 1px 2px rgba(23, 32, 51, 0.04),
            0 12px 32px rgba(23, 32, 51, 0.07);
          --ld-shadow-soft: 0 6px 18px rgba(23, 32, 51, 0.06);
          --ld-shadow-inset: inset 0 1px 0 rgba(255, 255, 255, 0.85);
          --ld-shadow-primary: 0 6px 16px rgba(49, 91, 234, 0.24);
          --ld-success: #047857;
          --ld-success-bg: rgba(4, 120, 87, 0.08);
          --ld-success-border: rgba(4, 120, 87, 0.28);
          --ld-warning: #b45309;
          --ld-warning-bg: rgba(180, 83, 9, 0.08);
          --ld-warning-border: rgba(180, 83, 9, 0.28);
          --ld-danger: #dc2626;
          --ld-danger-bg: rgba(220, 38, 38, 0.07);
          --ld-danger-border: rgba(220, 38, 38, 0.28);
          --ld-danger-solid: #dc2626;
          --ld-on-danger: #ffffff;
          --ld-info: #0e7490;
          --ld-info-bg: rgba(14, 116, 144, 0.08);
          --ld-info-border: rgba(14, 116, 144, 0.26);
        }
        /* =====================================================
           Renk paleti — karanlık mod
           (_document.tsx'teki script data-theme'i ilk boyamadan
           önce ayarlar; media query yalnızca JS'siz yedektir)
           ===================================================== */
        :root[data-theme="dark"] {
          color-scheme: dark;
          --ld-bg: #101419; /* ana arka plan */
          --ld-surface: #171d24; /* ana yüzey / kart */
          --ld-surface-2: #202833; /* ikincil yüzey */
          --ld-text: #e7eaf0;
          --ld-text-muted: #a9b1c1;
          --ld-border: #2b3440;
          --ld-border-strong: #37424f;
          --ld-primary: #8ea7ff; /* soft periwinkle */
          --ld-primary-hover: #a1b5ff;
          --ld-primary-rgb: 142, 167, 255;
          --ld-on-primary: #101419;
          --ld-primary-tint: rgba(142, 167, 255, 0.1);
          --ld-primary-tint-strong: rgba(142, 167, 255, 0.16);
          --ld-primary-border: rgba(142, 167, 255, 0.32);
          --ld-user-bubble: #23304a;
          --ld-user-bubble-text: #e7eaf0;
          --ld-user-bubble-border: #31415f;
          --ld-assistant-bubble: #171d24;
          --ld-code-bg: #0b1016;
          --ld-focus-ring: #8ea7ff;
          --ld-focus-shadow: 0 0 0 3px rgba(142, 167, 255, 0.28);
          --ld-nav-bg: rgba(16, 20, 25, 0.82);
          --ld-backdrop: rgba(4, 6, 10, 0.62);
          --ld-selection: rgba(142, 167, 255, 0.32);
          --ld-scrollbar: rgba(169, 177, 193, 0.3);
          --ld-scrollbar-hover: rgba(169, 177, 193, 0.5);
          --ld-grid-line: rgba(169, 177, 193, 0.045);
          --ld-glow-a: rgba(142, 167, 255, 0.07);
          --ld-glow-b: rgba(49, 91, 234, 0.1);
          --ld-veil: rgba(16, 20, 25, 0.92);
          --ld-hover-filter: brightness(1.1);
          --ld-shadow-panel: inset 0 1px 0 rgba(255, 255, 255, 0.04),
            0 16px 40px rgba(0, 0, 0, 0.45);
          --ld-shadow-soft: 0 8px 22px rgba(0, 0, 0, 0.35);
          --ld-shadow-inset: inset 0 1px 0 rgba(255, 255, 255, 0.04);
          --ld-shadow-primary: 0 6px 16px rgba(142, 167, 255, 0.18);
          --ld-success: #34d399;
          --ld-success-bg: rgba(52, 211, 153, 0.1);
          --ld-success-border: rgba(52, 211, 153, 0.3);
          --ld-warning: #fbbf24;
          --ld-warning-bg: rgba(251, 191, 36, 0.1);
          --ld-warning-border: rgba(251, 191, 36, 0.3);
          --ld-danger: #f87171;
          --ld-danger-bg: rgba(248, 113, 113, 0.1);
          --ld-danger-border: rgba(248, 113, 113, 0.3);
          --ld-danger-solid: #dc2626;
          --ld-on-danger: #ffffff;
          --ld-info: #22d3ee;
          --ld-info-bg: rgba(34, 211, 238, 0.08);
          --ld-info-border: rgba(34, 211, 238, 0.28);
        }
        /* JS çalışmazsa sistem tercihi karanlıksa yine karanlık göster. */
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]):not([data-theme="dark"]) {
            color-scheme: dark;
            --ld-bg: #101419;
            --ld-surface: #171d24;
            --ld-surface-2: #202833;
            --ld-text: #e7eaf0;
            --ld-text-muted: #a9b1c1;
            --ld-border: #2b3440;
            --ld-border-strong: #37424f;
            --ld-primary: #8ea7ff;
            --ld-primary-hover: #a1b5ff;
            --ld-primary-rgb: 142, 167, 255;
            --ld-on-primary: #101419;
            --ld-primary-tint: rgba(142, 167, 255, 0.1);
            --ld-primary-tint-strong: rgba(142, 167, 255, 0.16);
            --ld-primary-border: rgba(142, 167, 255, 0.32);
            --ld-user-bubble: #23304a;
            --ld-user-bubble-text: #e7eaf0;
            --ld-user-bubble-border: #31415f;
            --ld-assistant-bubble: #171d24;
            --ld-code-bg: #0b1016;
            --ld-focus-ring: #8ea7ff;
            --ld-focus-shadow: 0 0 0 3px rgba(142, 167, 255, 0.28);
            --ld-nav-bg: rgba(16, 20, 25, 0.82);
            --ld-backdrop: rgba(4, 6, 10, 0.62);
            --ld-selection: rgba(142, 167, 255, 0.32);
            --ld-scrollbar: rgba(169, 177, 193, 0.3);
            --ld-scrollbar-hover: rgba(169, 177, 193, 0.5);
            --ld-grid-line: rgba(169, 177, 193, 0.045);
            --ld-glow-a: rgba(142, 167, 255, 0.07);
            --ld-glow-b: rgba(49, 91, 234, 0.1);
            --ld-veil: rgba(16, 20, 25, 0.92);
            --ld-hover-filter: brightness(1.1);
            --ld-shadow-panel: inset 0 1px 0 rgba(255, 255, 255, 0.04),
              0 16px 40px rgba(0, 0, 0, 0.45);
            --ld-shadow-soft: 0 8px 22px rgba(0, 0, 0, 0.35);
            --ld-shadow-inset: inset 0 1px 0 rgba(255, 255, 255, 0.04);
            --ld-shadow-primary: 0 6px 16px rgba(142, 167, 255, 0.18);
            --ld-success: #34d399;
            --ld-success-bg: rgba(52, 211, 153, 0.1);
            --ld-success-border: rgba(52, 211, 153, 0.3);
            --ld-warning: #fbbf24;
            --ld-warning-bg: rgba(251, 191, 36, 0.1);
            --ld-warning-border: rgba(251, 191, 36, 0.3);
            --ld-danger: #f87171;
            --ld-danger-bg: rgba(248, 113, 113, 0.1);
            --ld-danger-border: rgba(248, 113, 113, 0.3);
            --ld-danger-solid: #dc2626;
            --ld-on-danger: #ffffff;
            --ld-info: #22d3ee;
            --ld-info-bg: rgba(34, 211, 238, 0.08);
            --ld-info-border: rgba(34, 211, 238, 0.28);
          }
        }

        * {
          box-sizing: border-box;
        }
        html {
          scroll-behavior: smooth;
        }
        html,
        body {
          margin: 0;
          padding: 0;
          font-family:
            system-ui,
            -apple-system,
            "Segoe UI",
            Roboto,
            sans-serif;
          background: var(--ld-bg);
          color: var(--ld-text);
          -webkit-font-smoothing: antialiased;
        }
        /* Sabit, katmanlı zemin: paletin primary tonlarında yumuşak ışımalar. */
        body::before {
          content: "";
          position: fixed;
          inset: 0;
          z-index: -2;
          pointer-events: none;
          background:
            radial-gradient(
              1200px 760px at 82% -12%,
              var(--ld-glow-a),
              transparent 60%
            ),
            radial-gradient(
              1000px 620px at -4% 4%,
              var(--ld-glow-b),
              transparent 55%
            ),
            radial-gradient(
              900px 700px at 50% 118%,
              var(--ld-glow-a),
              transparent 60%
            ),
            var(--ld-bg);
        }
        /* Üstte hafifçe görünen teknik grid dokusu. */
        body::after {
          content: "";
          position: fixed;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background-image:
            linear-gradient(var(--ld-grid-line) 1px, transparent 1px),
            linear-gradient(90deg, var(--ld-grid-line) 1px, transparent 1px);
          background-size: 44px 44px;
          -webkit-mask-image: radial-gradient(
            ellipse 85% 55% at 50% 0%,
            black 0%,
            transparent 72%
          );
          mask-image: radial-gradient(
            ellipse 85% 55% at 50% 0%,
            black 0%,
            transparent 72%
          );
        }

        ::selection {
          background: var(--ld-selection);
        }

        /* İnce, temaya uyumlu scrollbar. */
        * {
          scrollbar-width: thin;
          scrollbar-color: var(--ld-scrollbar) transparent;
        }
        ::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: var(--ld-scrollbar);
          border-radius: 999px;
          border: 3px solid transparent;
          background-clip: padding-box;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: var(--ld-scrollbar-hover);
          border: 3px solid transparent;
          background-clip: padding-box;
        }

        a {
          color: var(--ld-primary);
        }
        input,
        button,
        textarea {
          font-family: inherit;
          font-size: 1rem;
        }

        /* Klavye odağı her yerde belirgin olsun. */
        :focus {
          outline: none;
        }
        :focus-visible {
          outline: 2px solid var(--ld-focus-ring);
          outline-offset: 2px;
          border-radius: 4px;
        }

        button {
          transition:
            background 0.15s ease,
            opacity 0.15s ease,
            transform 0.1s ease,
            box-shadow 0.15s ease,
            border-color 0.15s ease,
            filter 0.15s ease,
            color 0.15s ease;
        }
        button:not(:disabled):hover {
          filter: var(--ld-hover-filter);
        }
        button:not(:disabled):active {
          transform: translateY(1px);
        }
        input,
        textarea {
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            background 0.15s ease;
        }
        input:focus,
        textarea:focus {
          border-color: var(--ld-focus-ring) !important;
          box-shadow: var(--ld-focus-shadow);
        }

        /* --- Liquid glass yardımcıları --- */
        /* Blur tek noktadan yönetilir; mobilde performans için azaltılır. */
        .ld-glass {
          backdrop-filter: blur(18px) saturate(150%);
          -webkit-backdrop-filter: blur(18px) saturate(150%);
        }
        .ld-glass-strong {
          backdrop-filter: blur(22px) saturate(160%);
          -webkit-backdrop-filter: blur(22px) saturate(160%);
        }
        .ld-glass-soft {
          backdrop-filter: blur(10px) saturate(130%);
          -webkit-backdrop-filter: blur(10px) saturate(130%);
        }
        /* Hover'da hafifçe yükselen, ışıklı border alan kartlar. */
        .ld-hover-card {
          transition:
            transform 0.18s ease,
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            background 0.18s ease;
        }
        .ld-hover-card:hover {
          transform: translateY(-2px);
          border-color: var(--ld-primary-border) !important;
          box-shadow: var(--ld-shadow-panel);
        }
        .ld-btn:not(:disabled):hover {
          transform: translateY(-1px);
          filter: brightness(1.07);
        }
        .ld-btn:not(:disabled):active {
          transform: translateY(0);
        }

        /* --- Scroll reveal (IntersectionObserver ile tetiklenir) --- */
        .ld-reveal {
          opacity: 0;
          transform: translateY(20px);
          transition:
            opacity 0.65s cubic-bezier(0.22, 0.61, 0.36, 1),
            transform 0.65s cubic-bezier(0.22, 0.61, 0.36, 1),
            filter 0.65s cubic-bezier(0.22, 0.61, 0.36, 1);
          will-change: opacity, transform;
        }
        .ld-reveal[data-variant="blur"] {
          filter: blur(8px);
        }
        .ld-reveal[data-variant="left"] {
          transform: translateX(-26px);
        }
        .ld-reveal[data-variant="right"] {
          transform: translateX(26px);
        }
        .ld-reveal.is-visible {
          opacity: 1;
          transform: none;
          filter: none;
        }

        /* --- Paylaşılan animasyonlar --- */
        @keyframes ld-spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes ld-fade-in {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes ld-fade-up {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes ld-blur-in {
          from {
            opacity: 0;
            filter: blur(8px);
          }
          to {
            opacity: 1;
            filter: blur(0);
          }
        }
        @keyframes ld-slide-in {
          from {
            opacity: 0;
            transform: translateX(-14px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes ld-shimmer {
          from {
            background-position: -200% 0;
          }
          to {
            background-position: 200% 0;
          }
        }
        @keyframes ld-pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.55;
          }
        }
        @keyframes ld-pulse-soft {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.75;
          }
        }
        @keyframes ld-float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        @keyframes ld-scanline {
          from {
            transform: translateY(-100%);
          }
          to {
            transform: translateY(340%);
          }
        }
        @keyframes ld-progress {
          from {
            transform: scaleX(0);
          }
          to {
            transform: scaleX(1);
          }
        }
        @keyframes ld-blink {
          0%,
          80%,
          100% {
            opacity: 0.2;
          }
          40% {
            opacity: 1;
          }
        }
        @keyframes ld-caret {
          0%,
          49% {
            opacity: 1;
          }
          50%,
          100% {
            opacity: 0;
          }
        }
        .ld-fade-in {
          animation: ld-fade-in 0.25s ease both;
        }
        .ld-fade-up {
          animation: ld-fade-up 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) both;
        }

        /* --- Sayfalar arası geçiş --- */
        /* fill-mode backwards: animasyon bitince transform "none"a döner;
           böylece sayfa içindeki position:fixed katmanlar (modal, glow)
           viewport'a göre konumlanmaya devam eder. */
        .ld-route-transition {
          animation: ld-route-enter 0.42s cubic-bezier(0.22, 0.61, 0.36, 1)
            backwards;
        }
        @keyframes ld-route-enter {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.995);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        /* Geçiş perdesi: markalı ışımalı katman. Cover'da ekranı kaplar,
           reveal'da yeni sayfanın üzerinden yumuşakça çekilir. */
        .ld-route-veil {
          position: fixed;
          inset: 0;
          z-index: 150;
          pointer-events: none;
          background:
            radial-gradient(
              900px 480px at 50% -10%,
              rgba(var(--ld-primary-rgb), 0.18),
              transparent 65%
            ),
            radial-gradient(
              700px 420px at 50% 110%,
              var(--ld-glow-b),
              transparent 60%
            ),
            var(--ld-veil);
        }
        .ld-route-veil.is-cover {
          animation: ld-veil-in 0.2s ease-out both;
        }
        .ld-route-veil.is-reveal {
          animation: ld-veil-out 0.36s cubic-bezier(0.22, 0.61, 0.36, 1) both;
        }
        @keyframes ld-veil-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes ld-veil-out {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
        /* Rota değişirken üstte süzülen ilerleme çubuğu. */
        .ld-route-progress {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          z-index: 200;
          pointer-events: none;
          background: linear-gradient(
            90deg,
            transparent,
            var(--ld-primary),
            var(--ld-focus-ring),
            transparent
          );
          background-size: 50% 100%;
          background-repeat: no-repeat;
          animation: ld-route-progress 0.9s ease-in-out infinite;
        }
        @keyframes ld-route-progress {
          from {
            background-position: -100% 0;
          }
          to {
            background-position: 200% 0;
          }
        }

        /* --- Modal (ConfirmDialog) giriş animasyonu --- */
        @keyframes ld-modal-in {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* --- Mobil uyum --- */
        @media (max-width: 640px) {
          .ld-card {
            padding: 1.25rem !important;
          }
          .ld-page {
            padding: 1rem !important;
          }
          /* Ağır blur mobilde pahalı; tek noktadan azalt. */
          .ld-glass,
          .ld-glass-strong {
            backdrop-filter: blur(10px) saturate(130%);
            -webkit-backdrop-filter: blur(10px) saturate(130%);
          }
        }

        /* --- Hareket azaltma tercihi --- */
        @media (prefers-reduced-motion: reduce) {
          html {
            scroll-behavior: auto;
          }
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
          .ld-reveal {
            opacity: 1 !important;
            transform: none !important;
            filter: none !important;
          }
        }
      `}</style>
    </AuthProvider>
  );
}
