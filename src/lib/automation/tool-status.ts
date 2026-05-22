export type InternalToolStatusValue =
  | "ready"
  | "degraded"
  | "offline"
  | "not_configured"
  | "auth_failed"
  | "schema_missing"
  | "invalid_response";

export type InternalToolDefinition = {
  id: string;
  displayName: string;
  sourceTool: string;
  baseUrlEnvVar: string;
  healthPath: string;
  automationSchemaPath: string;
  expectedInboundEvents: string[];
  expectedOutboundEvents: string[];
  staffDirectoryRelevant: boolean;
  defaultBaseUrl?: string;
};

export type InternalToolStatus = {
  id: string;
  displayName: string;
  sourceTool: string;
  baseUrlEnvVar: string;
  baseUrl: string | null;
  healthPath: string;
  automationSchemaPath: string;
  status: InternalToolStatusValue;
  healthStatus: InternalToolStatusValue;
  schemaStatus: InternalToolStatusValue;
  authReady: boolean;
  n8nReady: boolean;
  staffDirectoryRelevant: boolean;
  inboundEvents: string[];
  outboundEvents: string[];
  expectedInboundEvents: string[];
  expectedOutboundEvents: string[];
  lastCheckedAt: string;
  error: string | null;
};

export type InternalToolsStatusResponse = {
  generatedAt: string;
  summary: {
    total: number;
    ready: number;
    degraded: number;
    offline: number;
    notConfigured: number;
    authFailed: number;
    schemaMissing: number;
    invalidResponse: number;
  };
  tools: InternalToolStatus[];
};

type AutomationSchemaResponse = {
  inboundEvents?: unknown;
  outboundEvents?: unknown;
  webhookReady?: unknown;
};

type FetchJsonResult =
  | { ok: true; statusCode: number; json: unknown }
  | { ok: false; statusCode: number | null; status: InternalToolStatusValue; error: string };

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/org-chart";

const internalTools: InternalToolDefinition[] = [
  {
    id: "org-chart",
    displayName: "Org Chart",
    sourceTool: "RS_Tool-Auto-Org_Chart-Generator",
    baseUrlEnvVar: "INTERNAL_TOOL_ORG_CHART_URL",
    healthPath: "/api/health",
    automationSchemaPath: "/api/automation/schema",
    expectedInboundEvents: ["org_chart.people.snapshot_requested"],
    expectedOutboundEvents: ["org_chart.people.snapshot_ready", "org_chart.person.updated"],
    staffDirectoryRelevant: true,
  },
  {
    id: "certificate-creator",
    displayName: "Certificate Creator",
    sourceTool: "RS_Tool-Romega-Certificate-Creator",
    baseUrlEnvVar: "INTERNAL_TOOL_CERTIFICATE_URL",
    healthPath: "/api/health",
    automationSchemaPath: "/api/automation/schema",
    expectedInboundEvents: ["org_chart.people.snapshot_ready"],
    expectedOutboundEvents: ["certificate.send_requested"],
    staffDirectoryRelevant: true,
  },
  {
    id: "email-signature",
    displayName: "Email Signature",
    sourceTool: "RS_Tool-Email-Signature",
    baseUrlEnvVar: "INTERNAL_TOOL_EMAIL_SIGNATURE_URL",
    healthPath: "/api/health",
    automationSchemaPath: "/api/automation/schema",
    expectedInboundEvents: ["org_chart.people.snapshot_ready"],
    expectedOutboundEvents: ["email_signature.send_requested"],
    staffDirectoryRelevant: true,
  },
  {
    id: "job-scraper",
    displayName: "Job Scraper",
    sourceTool: "RS_Tool-Job_Scraper",
    baseUrlEnvVar: "INTERNAL_TOOL_JOB_SCRAPER_URL",
    healthPath: "/health",
    automationSchemaPath: "/api/automation/schema",
    expectedInboundEvents: [],
    expectedOutboundEvents: ["jobs.scrape.completed"],
    staffDirectoryRelevant: false,
  },
];

function getEnvValue(name: string) {
  const value = process.env[name]?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

function getInternalApiKey() {
  return (
    process.env.INTERNAL_TOOL_API_KEY?.trim() ||
    process.env.API_KEY?.trim() ||
    process.env.ORGCHART_API_KEY?.trim() ||
    null
  );
}

function getSelfBaseUrl(requestUrl: string) {
  const url = new URL(requestUrl);
  return `${url.origin}${basePath === "/" ? "" : basePath}`.replace(/\/$/, "");
}

function buildUrl(baseUrlValue: string, path: string) {
  return `${baseUrlValue.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function hasExpectedEvents(actual: string[], expected: string[]) {
  return expected.every((event) => actual.includes(event));
}

async function fetchJson(url: string, apiKey: string | null): Promise<FetchJsonResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);

  try {
    const response = await fetch(url, {
      headers: apiKey ? { "X-API-Key": apiKey } : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, statusCode: response.status, status: "auth_failed", error: `HTTP ${response.status}` };
    }

    if (response.status === 404) {
      return { ok: false, statusCode: response.status, status: "schema_missing", error: "HTTP 404" };
    }

    if (!response.ok) {
      return { ok: false, statusCode: response.status, status: "degraded", error: `HTTP ${response.status}` };
    }

    try {
      return { ok: true, statusCode: response.status, json: await response.json() };
    } catch {
      return { ok: false, statusCode: response.status, status: "invalid_response", error: "Invalid JSON response" };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed";
    return { ok: false, statusCode: null, status: "offline", error: message };
  } finally {
    clearTimeout(timeout);
  }
}

function summarize(tools: InternalToolStatus[]): InternalToolsStatusResponse["summary"] {
  return {
    total: tools.length,
    ready: tools.filter((tool) => tool.status === "ready").length,
    degraded: tools.filter((tool) => tool.status === "degraded").length,
    offline: tools.filter((tool) => tool.status === "offline").length,
    notConfigured: tools.filter((tool) => tool.status === "not_configured").length,
    authFailed: tools.filter((tool) => tool.status === "auth_failed").length,
    schemaMissing: tools.filter((tool) => tool.status === "schema_missing").length,
    invalidResponse: tools.filter((tool) => tool.status === "invalid_response").length,
  };
}

function resolveStatus(
  health: FetchJsonResult,
  schema: FetchJsonResult,
  inboundEvents: string[],
  outboundEvents: string[],
  tool: InternalToolDefinition,
): InternalToolStatusValue {
  if (!health.ok && !schema.ok && health.status === "offline" && schema.status === "offline") return "offline";
  if (!schema.ok && schema.status === "auth_failed") return "auth_failed";
  if (!schema.ok && schema.status === "schema_missing") return "schema_missing";
  if (!schema.ok && schema.status === "invalid_response") return "invalid_response";
  if (!health.ok && health.status === "auth_failed") return "auth_failed";
  if (!health.ok && health.status === "invalid_response") return "invalid_response";
  if (!schema.ok) return "degraded";
  if (!hasExpectedEvents(inboundEvents, tool.expectedInboundEvents)) return "degraded";
  if (!hasExpectedEvents(outboundEvents, tool.expectedOutboundEvents)) return "degraded";
  if (!health.ok) return "degraded";
  return "ready";
}

export async function getInternalToolsStatus(requestUrl: string): Promise<InternalToolsStatusResponse> {
  const generatedAt = new Date().toISOString();
  const apiKey = getInternalApiKey();
  const selfBaseUrl = getSelfBaseUrl(requestUrl);

  const tools = await Promise.all(
    internalTools.map(async (tool): Promise<InternalToolStatus> => {
      const configuredBaseUrl = getEnvValue(tool.baseUrlEnvVar);
      const baseUrlValue = configuredBaseUrl ?? (tool.id === "org-chart" ? selfBaseUrl : null);

      if (!baseUrlValue) {
        return {
          id: tool.id,
          displayName: tool.displayName,
          sourceTool: tool.sourceTool,
          baseUrlEnvVar: tool.baseUrlEnvVar,
          baseUrl: null,
          healthPath: tool.healthPath,
          automationSchemaPath: tool.automationSchemaPath,
          status: "not_configured",
          healthStatus: "not_configured",
          schemaStatus: "not_configured",
          authReady: Boolean(apiKey),
          n8nReady: false,
          staffDirectoryRelevant: tool.staffDirectoryRelevant,
          inboundEvents: tool.expectedInboundEvents,
          outboundEvents: tool.expectedOutboundEvents,
          expectedInboundEvents: tool.expectedInboundEvents,
          expectedOutboundEvents: tool.expectedOutboundEvents,
          lastCheckedAt: generatedAt,
          error: `${tool.baseUrlEnvVar} is not configured`,
        };
      }

      const [health, schema] = await Promise.all([
        fetchJson(buildUrl(baseUrlValue, tool.healthPath), apiKey),
        fetchJson(buildUrl(baseUrlValue, tool.automationSchemaPath), apiKey),
      ]);

      const schemaJson = schema.ok ? (schema.json as AutomationSchemaResponse) : {};
      const inboundEvents = readStringArray(schemaJson.inboundEvents);
      const outboundEvents = readStringArray(schemaJson.outboundEvents);
      const status = resolveStatus(health, schema, inboundEvents, outboundEvents, tool);
      const schemaError = schema.ok ? null : schema.error;
      const healthError = health.ok ? null : health.error;

      return {
        id: tool.id,
        displayName: tool.displayName,
        sourceTool: tool.sourceTool,
        baseUrlEnvVar: tool.baseUrlEnvVar,
        baseUrl: baseUrlValue,
        healthPath: tool.healthPath,
        automationSchemaPath: tool.automationSchemaPath,
        status,
        healthStatus: health.ok ? "ready" : health.status,
        schemaStatus: schema.ok ? "ready" : schema.status,
        authReady: Boolean(apiKey) && status !== "auth_failed",
        n8nReady: schema.ok && schemaJson.webhookReady === true,
        staffDirectoryRelevant: tool.staffDirectoryRelevant,
        inboundEvents: inboundEvents.length > 0 ? inboundEvents : tool.expectedInboundEvents,
        outboundEvents: outboundEvents.length > 0 ? outboundEvents : tool.expectedOutboundEvents,
        expectedInboundEvents: tool.expectedInboundEvents,
        expectedOutboundEvents: tool.expectedOutboundEvents,
        lastCheckedAt: generatedAt,
        error: schemaError ?? healthError,
      };
    }),
  );

  return {
    generatedAt,
    summary: summarize(tools),
    tools,
  };
}
