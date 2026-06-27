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
        html,
        body {
          margin: 0;
          padding: 0;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          background: #0f172a;
          color: #e2e8f0;
        }
        a {
          color: #60a5fa;
        }
        input,
        button {
          font-family: inherit;
          font-size: 1rem;
        }
        /* Düğme ve girişlerde yumuşak geçişler (Hafta 6 — animasyonlu his). */
        button {
          transition:
            background 0.15s ease,
            opacity 0.15s ease,
            transform 0.1s ease,
            box-shadow 0.15s ease,
            border-color 0.15s ease;
        }
        button:not(:disabled):hover {
          filter: brightness(1.08);
        }
        button:not(:disabled):active {
          transform: translateY(1px);
        }
        input,
        textarea {
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        input:focus,
        textarea:focus {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.25);
        }

        /* --- Paylaşılan animasyonlar (Hafta 6) --- */
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
        @keyframes ld-pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.55;
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
        .ld-fade-in {
          animation: ld-fade-in 0.25s ease both;
        }

        /* --- Mobil uyumlu düzen (Hafta 6 — responsive gözden geçirme) --- */
        @media (max-width: 640px) {
          .ld-card {
            padding: 1.25rem !important;
            border-radius: 10px !important;
          }
          .ld-page {
            padding: 1rem !important;
          }
        }
      `}</style>
    </AuthProvider>
  );
}
