// ESLint flat config (ESLint 10 + Next 16).
// `next lint` Next 16'da kaldırıldığı için ESLint doğrudan çalıştırılır:
//   bunx eslint .
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // eslint-config-next, React sürümünü "detect" ile bulmaya çalışır; bu yol
    // ESLint 10'da kaldırılan context.getFilename()'i çağırıp patlıyor.
    // Sürümü sabitleyince otomatik tespit devre dışı kalır.
    settings: { react: { version: "19.2" } },
  },
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
];

export default config;
