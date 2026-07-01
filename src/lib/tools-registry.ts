export type ToolEntry = {
  slug: string;
  name: string;
  description: string;
  href: string;
  status: "live" | "planned";
};

const optionalToolUrls = {
  ats: process.env.TOOLS_ATS_URL ?? "https://rs-tool-ats.vercel.app",
  "certificate-creator": process.env.TOOLS_CERTIFICATE_CREATOR_URL ?? "https://rs-tool-romega-certificate-creator.vercel.app",
  "job-scraper": process.env.TOOLS_JOB_SCRAPER_URL ?? "https://rs-tool-job-scraper.vercel.app",
  ticketing: process.env.TOOLS_TICKETING_URL,
};

export const toolEntries: ToolEntry[] = [
  {
    slug: "org-chart",
    name: "Org Chart",
    description: "Manage team structure, departments, sync reviews, and public chart links.",
    href: "/org-chart/chart",
    status: "live",
  },
  {
    slug: "email-signature",
    name: "Email Signature",
    description: "Generate branded Romega email signatures and send delivery requests to automation.",
    href: "/email-signature",
    status: "live",
  },
  {
    slug: "ats",
    name: "ATS",
    description: "Internal tools portal and applicant tracking workflows.",
    href: optionalToolUrls.ats ?? "#",
    status: optionalToolUrls.ats ? "live" : "planned",
  },
  {
    slug: "certificate-creator",
    name: "Certificate Creator",
    description: "Create and queue certificate delivery through the internal automation stack.",
    href: optionalToolUrls["certificate-creator"] ?? "#",
    status: optionalToolUrls["certificate-creator"] ? "live" : "planned",
  },
  {
    slug: "job-scraper",
    name: "Job Scraper",
    description: "Monitor job scraping health and schema-ready automation endpoints.",
    href: optionalToolUrls["job-scraper"] ?? "#",
    status: optionalToolUrls["job-scraper"] ? "live" : "planned",
  },
  {
    slug: "ticketing",
    name: "Ticketing",
    description: "Shared support ticket workflow for internal requests.",
    href: optionalToolUrls.ticketing ?? "#",
    status: optionalToolUrls.ticketing ? "live" : "planned",
  },
];
