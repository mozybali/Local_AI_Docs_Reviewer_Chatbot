import type { AppProps } from "next/app";
import Head from "next/head";
import { AuthProvider } from "../context/AuthContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <title>LocalDoc AI</title>
      </Head>
      <Component {...pageProps} />
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }
        html {
          color-scheme: dark;
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
          background: #05070d;
          color: #e2e8f0;
          -webkit-font-smoothing: antialiased;
        }
        /* Sabit, katmanlı ışık zemini: mavi + cyan halkalar koyu lacivert üzerinde. */
        body::before {
          content: "";
          position: fixed;
          inset: 0;
          z-index: -2;
          pointer-events: none;
          background:
            radial-gradient(
              1200px 760px at 82% -12%,
              rgba(37, 99, 235, 0.17),
              transparent 60%
            ),
            radial-gradient(
              1000px 620px at -4% 4%,
              rgba(34, 211, 238, 0.09),
              transparent 55%
            ),
            radial-gradient(
              900px 700px at 50% 118%,
              rgba(37, 99, 235, 0.1),
              transparent 60%
            ),
            linear-gradient(180deg, #070b16 0%, #04060d 100%);
        }
        /* Üstte hafifçe görünen teknik grid dokusu. */
        body::after {
          content: "";
          position: fixed;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(148, 163, 184, 0.045) 1px, transparent 1px),
            linear-gradient(
              90deg,
              rgba(148, 163, 184, 0.045) 1px,
              transparent 1px
            );
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
          background: rgba(37, 99, 235, 0.5);
          color: #eff6ff;
        }

        /* İnce, koyu temaya uyumlu scrollbar. */
        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(71, 85, 105, 0.6) transparent;
        }
        ::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(71, 85, 105, 0.55);
          border-radius: 999px;
          border: 3px solid transparent;
          background-clip: padding-box;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.75);
          border: 3px solid transparent;
          background-clip: padding-box;
        }

        a {
          color: #60a5fa;
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
          outline: 2px solid rgba(96, 165, 250, 0.75);
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
          filter: brightness(1.08);
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
          border-color: rgba(96, 165, 250, 0.75) !important;
          box-shadow:
            0 0 0 3px rgba(37, 99, 235, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
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
          border-color: rgba(96, 165, 250, 0.45) !important;
          box-shadow:
            0 16px 40px rgba(2, 6, 16, 0.55),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
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
