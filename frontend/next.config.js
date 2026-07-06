/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Tarayıcı backend'e doğrudan değil, bu proxy üzerinden ulaşır: /backend/*
  // istekleri Next sunucusu tarafından FastAPI'ye iletilir. Böylece tek origin
  // (ve tek tünel) yeter; CORS'a ve ikinci bir public porta gerek kalmaz.
  // BACKEND_INTERNAL_URL build sırasında okunur (Docker'da ör. http://backend:8000).
  async rewrites() {
    const backendUrl = process.env.BACKEND_INTERNAL_URL || "http://localhost:8000";
    return [
      {
        source: "/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
