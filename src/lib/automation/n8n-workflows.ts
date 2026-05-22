export type N8nWorkflowStatus = "active" | "config_required";

export type N8nWorkflowReadiness = {
  id: string;
  name: string;
  workflowId: string;
  webhookPath: string;
  status: N8nWorkflowStatus;
  requiredConfig: string[];
  lastEvidence: string;
  lastVerifiedAt: string | null;
};

export const n8nWorkflowReadiness: N8nWorkflowReadiness[] = [
  {
    id: "staff-snapshot-sync",
    name: "Romega - Staff Snapshot Sync",
    workflowId: "mkOb89BpXfaOkonk",
    webhookPath: "/webhook/romega/staff-snapshot-sync",
    status: "config_required",
    requiredConfig: ["orgChartBaseUrl", "internalToolApiKey"],
    lastEvidence: "Imported and updated with Config - Internal Tools node.",
    lastVerifiedAt: null,
  },
  {
    id: "certificate-delivery",
    name: "Romega - Certificate Delivery",
    workflowId: "SNHP4tWQTbQx63vN",
    webhookPath: "/webhook/romega/certificate-delivery",
    status: "config_required",
    requiredConfig: ["certificateBaseUrl", "internalToolApiKey"],
    lastEvidence: "Imported and updated with Config - Internal Tools node.",
    lastVerifiedAt: null,
  },
  {
    id: "email-signature-delivery",
    name: "Romega - Email Signature Delivery",
    workflowId: "e17dE0LolNtdDJ1O",
    webhookPath: "/webhook/romega/email-signature-delivery",
    status: "config_required",
    requiredConfig: ["emailSignatureBaseUrl", "internalToolApiKey"],
    lastEvidence: "Imported and updated with Config - Internal Tools node.",
    lastVerifiedAt: null,
  },
  {
    id: "job-scrape-report",
    name: "Romega - Job Scrape Report",
    workflowId: "nAYEzJsPaPNtAI1V",
    webhookPath: "/webhook/romega/job-scrape-report",
    status: "active",
    requiredConfig: [],
    lastEvidence: "Execution 120",
    lastVerifiedAt: "2026-05-22T00:00:00.000Z",
  },
];
