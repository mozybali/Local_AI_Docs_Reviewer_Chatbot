import type { AppProps } from "next/app";
import { AuthProvider } from "../context/AuthContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
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
      `}</style>
    </AuthProvider>
  );
}
