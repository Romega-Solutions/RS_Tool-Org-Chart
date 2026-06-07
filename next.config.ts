import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/org-chart";
const emailSignatureUrl = process.env.EMAIL_SIGNATURE_PUBLIC_URL ?? "https://rs-tool-email-signature.vercel.app";

const nextConfig: NextConfig = {
  basePath,
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "sharp"],
  async redirects() {
    return [
      {
        source: "/",
        destination: `${basePath}/chart`,
        permanent: false,
        basePath: false,
      },
      {
        source: "/email-signature",
        destination: emailSignatureUrl,
        permanent: false,
        basePath: false,
      },
      {
        source: "/email-signature/:path*",
        destination: `${emailSignatureUrl}/:path*`,
        permanent: false,
        basePath: false,
      },
      {
        source: "/:path((?!org-chart|email-signature|_next|api|uploads|assets|favicon.ico).*)",
        destination: `${basePath}/:path`,
        permanent: false,
        basePath: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
    ];
  },
};

export default nextConfig;
