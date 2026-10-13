import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/org-chart";
const emailSignatureUrl = process.env.EMAIL_SIGNATURE_PUBLIC_URL ?? "https://rs-tool-email-signature.vercel.app";
const defaultToolUrls = {
  ats: process.env.TOOLS_ATS_URL ?? "https://rs-tool-ats.vercel.app",
  certificateCreator: process.env.TOOLS_CERTIFICATE_CREATOR_URL ?? "https://rs-tool-romega-certificate-creator.vercel.app",
  jobScraper: process.env.TOOLS_JOB_SCRAPER_URL ?? "https://rs-tool-job-scraper.vercel.app",
  ticketing: process.env.TOOLS_TICKETING_URL ?? "https://portal.romega-solutions.com",
};
const reservedRootSegments = [
  "org-chart",
  "email-signature",
  "ats",
  "certificate-creator",
  "job-scraper",
  "portal",
  "ticketing",
  "tools",
  "_astro",
  "_next",
  "api",
  "uploads",
  "assets",
  "address.svg",
  "at.svg",
  "call.svg",
  "fav-icon.ico",
  "favicon.ico",
  "globe.svg",
  "romega-logo.svg",
].join("|");

function toolRedirects(source: string, destination?: string) {
  const target = destination ? destination.replace(/\/$/, "") : "/";
  const pathTarget = target === "/" ? "/" : `${target}/:path*`;

  return [
    {
      source,
      destination: target,
      permanent: false,
      basePath: false as const,
    },
    {
      source: `${source}/:path*`,
      destination: pathTarget,
      permanent: false,
      basePath: false as const,
    },
  ];
}

const nextConfig: NextConfig = {
  basePath,
  output: "standalone",
  // Pin the tracing root to this project so a stray lockfile in a parent folder
  // can't nest the standalone output (e.g. .next/standalone/Desktop/.../server.js).
  outputFileTracingRoot: process.cwd(),
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
      {
        source: "/address.svg",
        destination: `${emailSignatureUrl}/address.svg`,
        basePath: false,
      },
      {
        source: "/at.svg",
        destination: `${emailSignatureUrl}/at.svg`,
        basePath: false,
      },
      {
        source: "/call.svg",
        destination: `${emailSignatureUrl}/call.svg`,
        basePath: false,
      },
      {
        source: "/fav-icon.ico",
        destination: `${emailSignatureUrl}/fav-icon.ico`,
        basePath: false,
      },
      {
        source: "/globe.svg",
        destination: `${emailSignatureUrl}/globe.svg`,
        basePath: false,
      },
      {
        source: "/romega-logo.svg",
        destination: `${emailSignatureUrl}/romega-logo.svg`,
        basePath: false,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: `${basePath}/tools`,
        destination: "/",
        permanent: false,
        basePath: false,
      },
      ...toolRedirects("/ats", defaultToolUrls.ats),
      ...toolRedirects("/certificate-creator", defaultToolUrls.certificateCreator),
      ...toolRedirects("/job-scraper", defaultToolUrls.jobScraper),
      ...toolRedirects("/portal", defaultToolUrls.ticketing),
      ...toolRedirects("/ticketing", defaultToolUrls.ticketing),
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
