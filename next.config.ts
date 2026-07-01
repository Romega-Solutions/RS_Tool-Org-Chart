import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/org-chart";
const emailSignatureUrl = process.env.EMAIL_SIGNATURE_PUBLIC_URL ?? "https://rs-tool-email-signature.vercel.app";
const reservedRootSegments = [
  "org-chart",
  "email-signature",
  "ats",
  "certificate-creator",
  "job-scraper",
  "ticketing",
  "tools",
  "_next",
  "api",
  "uploads",
  "assets",
  "favicon.ico",
].join("|");

function toolRedirects(source: string, destination?: string) {
  if (!destination) return [];
  const target = destination.replace(/\/$/, "");

  return [
    {
      source,
      destination: target,
      permanent: false,
      basePath: false as const,
    },
    {
      source: `${source}/:path*`,
      destination: `${target}/:path*`,
      permanent: false,
      basePath: false as const,
    },
  ];
}

const nextConfig: NextConfig = {
  basePath,
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "sharp"],
  async rewrites() {
    return [
      {
        source: "/email-signature",
        destination: emailSignatureUrl,
        basePath: false,
      },
      {
        source: "/email-signature/:path*",
        destination: `${emailSignatureUrl}/:path*`,
        basePath: false,
      },
      {
        source: "/_astro/:path*",
        destination: `${emailSignatureUrl}/_astro/:path*`,
        basePath: false,
      },
      {
        source: "/api/signature/:path*",
        destination: `${emailSignatureUrl}/api/signature/:path*`,
        basePath: false,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: `${basePath}/tools`,
        permanent: false,
        basePath: false,
      },
      ...toolRedirects("/ats", process.env.TOOLS_ATS_URL),
      ...toolRedirects("/certificate-creator", process.env.TOOLS_CERTIFICATE_CREATOR_URL),
      ...toolRedirects("/job-scraper", process.env.TOOLS_JOB_SCRAPER_URL),
      ...toolRedirects("/ticketing", process.env.TOOLS_TICKETING_URL),
      {
        source: `/:path((?!${reservedRootSegments}).*)`,
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
