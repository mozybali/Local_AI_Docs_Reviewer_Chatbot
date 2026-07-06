import { Html, Head, Main, NextScript } from "next/document";

// İlk boyamadan önce çalışır: kayıtlı tema ya da sistem tercihi data-theme'e
// yazılır; böylece sayfa yanlış temada "yanıp sönmez" (FOUC önlenir).
const THEME_INIT = `(function(){try{var t=localStorage.getItem("ld-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=t;}catch(e){}})();`;

// Özel Document: dil etiketi ve mobil uyumlu görüntü alanı (viewport) ayarı.
export default function Document() {
  return (
    <Html lang="tr">
      <Head>
        <meta charSet="utf-8" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
