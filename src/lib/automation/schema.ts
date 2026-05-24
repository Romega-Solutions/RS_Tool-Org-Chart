export type AutomationActorType = "user" | "api" | "n8n";

export type AutomationEnvelope<TData> = {
  event: string;
  sourceTool: string;
  version: "1.0";
  requestId: string;
  occurredAt: string;
  actor: {
    type: AutomationActorType;
    id?: string;
    name?: string;
  };
  data: TData;
};

export type StaffProfile = {
  id: number;
  name: string;
  title: string;
  email: string | null;
  departmentId: number | null;
  departmentName: string | null;
  managerId: number | null;
  isActive: boolean;
};

const sourceTool = "RS_Tool-Auto-Org_Chart-Generator";

export const staffProfileFields = [
  "id",
  "name",
  "title",
  "email",
  "departmentId",
  "departmentName",
  "managerId",
  "isActive",
] as const;

export const orgChartAutomationSchema = {
  version: "1.0",
  service: "org-chart",
  sourceTool,
  auth: {
    header: "X-API-Key",
    envVars: ["API_KEY", "ORGCHART_API_KEY"],
  },
  staffDirectory: {
    endpoint: "/api/people/headless?includeInactive=false",
    profileFields: staffProfileFields,
  },
  alerts: {
    endpoint: "/api/automation/alerts",
    historyEndpoint: "/api/automation/alerts?limit=20",
    events: ["internal_tools.workflow_failed"],
    storage: process.env.VERCEL === "1" ? "ephemeral_serverless_file" : "local_json_file",
  },
  inboundEvents: ["org_chart.people.snapshot_requested", "internal_tools.workflow_failed"],
  outboundEvents: ["org_chart.people.snapshot_ready", "org_chart.person.updated"],
  webhookReady: true,
  exampleEnvelope: {
    event: "org_chart.people.snapshot_ready",
    sourceTool,
    version: "1.0",
    requestId: "org_20260521_example",
    occurredAt: "2026-05-21T00:00:00.000Z",
    actor: {
      type: "api",
      name: "API Integration",
    },
    data: {
      people: [
        {
          id: 1,
          name: "Romega Staff",
          title: "Team Member",
          email: "staff@example.com",
          departmentId: 1,
          departmentName: "Operations",
          managerId: null,
          isActive: true,
        },
      ],
    },
  } satisfies AutomationEnvelope<{ people: StaffProfile[] }>,
} as const;
