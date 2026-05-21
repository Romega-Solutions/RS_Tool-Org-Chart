export type AutomationActorType = "tool" | "agent" | "system";

export type AutomationEnvelope<TData> = {
  id: string;
  version: "1.0";
  event: string;
  source: string;
  actor: {
    type: AutomationActorType;
    id: string;
  };
  occurredAt: string;
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
  inboundEvents: [
    {
      event: "org_chart.people.snapshot_requested",
      description: "Request a staff directory snapshot from the Org Chart tool.",
    },
  ],
  outboundEvents: [
    {
      event: "org_chart.people.snapshot_ready",
      description: "Staff directory snapshot is ready for downstream automation.",
    },
    {
      event: "org_chart.person.updated",
      description: "A staff profile was created, updated, moved, or deactivated.",
    },
  ],
  webhookReady: true,
  exampleEnvelope: {
    id: "evt_org_chart_example",
    version: "1.0",
    event: "org_chart.people.snapshot_ready",
    source: sourceTool,
    actor: {
      type: "tool",
      id: sourceTool,
    },
    occurredAt: "2026-01-01T00:00:00.000Z",
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
