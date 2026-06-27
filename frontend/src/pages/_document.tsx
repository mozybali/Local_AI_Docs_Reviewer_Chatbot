import { Html, Head, Main, NextScript } from "next/document";

// Özel Document: dil etiketi ve mobil uyumlu görüntü alanı (viewport) ayarı.
export default function Document() {
  return (
    <Html lang="tr">
      <Head>
        <meta charSet="utf-8" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
