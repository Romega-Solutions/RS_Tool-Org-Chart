export type N8nWorkflowStatus = "active" | "config_required";
export type N8nWorkflowConfigMode = "stable" | "temporary_tunnel" | "placeholder" | "unknown";

export type N8nWorkflowReadiness = {
  id: string;
  name: string;
  workflowId: string;
  webhookPath: string;
  status: N8nWorkflowStatus;
  statusSource?: "static" | "live";
  requiredConfig: string[];
  lastEvidence: string;
  lastVerifiedAt: string | null;
  latestExecutionStatus?: string | null;
  liveError?: string | null;
  configUrlMode?: N8nWorkflowConfigMode;
  configUrlHost?: string | null;
};

export const n8nWorkflowReadiness: N8nWorkflowReadiness[] = [
  {
    id: "staff-snapshot-sync",
    name: "Romega - Staff Snapshot Sync",
    workflowId: "mkOb89BpXfaOkonk",
    webhookPath: "/webhook/romega/staff-snapshot-sync",
    status: "active",
    requiredConfig: [],
    lastEvidence: "Execution 125",
    lastVerifiedAt: "2026-05-22T20:56:04.123Z",
  },
  {
    id: "certificate-delivery",
    name: "Romega - Certificate Delivery",
    workflowId: "SNHP4tWQTbQx63vN",
    webhookPath: "/webhook/romega/certificate-delivery",
    status: "active",
    requiredConfig: [],
    lastEvidence: "Execution 130",
    lastVerifiedAt: "2026-05-22T21:00:28.297Z",
  },
  {
    id: "email-signature-delivery",
    name: "Romega - Email Signature Delivery",
    workflowId: "e17dE0LolNtdDJ1O",
    webhookPath: "/webhook/romega/email-signature-delivery",
    status: "active",
    requiredConfig: [],
    lastEvidence: "Execution 129",
    lastVerifiedAt: "2026-05-22T20:58:16.537Z",
  },
  {
    id: "job-scrape-report",
    name: "Romega - Job Scrape Report",
    workflowId: "nAYEzJsPaPNtAI1V",
    webhookPath: "/webhook/romega/job-scrape-report",
    status: "active",
    requiredConfig: [],
    lastEvidence: "Execution 247",
    lastVerifiedAt: "2026-05-24T04:01:47.004Z",
  },
  {
    id: "direct-job-scraper-automation",
    name: "Romega - Direct Job Scraper Automation",
    workflowId: "4V9yjly8HqP2XS8W",
    webhookPath: "/webhook/romega/job-scraper-direct",
    status: "active",
    requiredConfig: [],
    lastEvidence: "Execution 248",
    lastVerifiedAt: "2026-05-24T04:01:52.699Z",
    configUrlMode: "stable",
    configUrlHost: "rs-tool-job-scraper.vercel.app",
  },
  {
    id: "internal-tools-failure-alert",
    name: "Romega - Internal Tools Failure Alert",
    workflowId: "e4JWNpiO87BM1rL2",
    webhookPath: "Error Trigger",
    status: "active",
    requiredConfig: [],
    lastEvidence: "Live error probe received by Org Chart",
    lastVerifiedAt: "2026-05-24T02:59:00.000Z",
    configUrlMode: "stable",
    configUrlHost: "rs-tool-auto-org-chart-generator.vercel.app",
  },
];
