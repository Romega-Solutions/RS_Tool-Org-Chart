import {
  n8nWorkflowReadiness,
  type N8nWorkflowConfigMode,
  type N8nWorkflowReadiness,
} from "./n8n-workflows";

type N8nWorkflowResponse = {
  active?: boolean;
  nodes?: Array<{
    name?: string;
    parameters?: {
      assignments?: {
        assignments?: Array<{
          name?: string;
          value?: string;
        }>;
      };
    };
  }>;
};

type N8nExecutionResponse = {
  data?: N8nExecution[];
};

type N8nExecution = {
  id?: string | number;
  status?: string;
  finished?: boolean;
  startedAt?: string;
  stoppedAt?: string;
};

const N8N_TIMEOUT_MS = 8_000;
const CONFIG_URL_ASSIGNMENTS = new Set([
  "orgChartBaseUrl",
  "certificateBaseUrl",
  "emailSignatureBaseUrl",
  "jobScraperBaseUrl",
  "alertWebhookUrl",
]);

function staticWorkflows(liveError?: string): N8nWorkflowReadiness[] {
  return n8nWorkflowReadiness.map((workflow) => ({
    ...workflow,
    statusSource: "static",
    liveError,
  }));
}

function getN8nConfig() {
  const url = process.env.N8N_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.N8N_API_KEY?.trim();

  if (!url || !apiKey) {
    return null;
  }

  return { url, apiKey };
}

async function fetchJson<T>(url: string, apiKey: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-N8N-API-KEY": apiKey,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`n8n API returned ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function executionEvidence(workflow: N8nWorkflowReadiness, execution?: N8nExecution) {
  if (!execution?.id) {
    return {
      lastEvidence: workflow.lastEvidence,
      lastVerifiedAt: workflow.lastVerifiedAt,
      latestExecutionStatus: null,
    };
  }

  const latestExecutionStatus = execution.status ?? (execution.finished ? "success" : "unknown");

  return {
    lastEvidence: `Execution ${execution.id} ${latestExecutionStatus}`,
    lastVerifiedAt: execution.stoppedAt ?? execution.startedAt ?? workflow.lastVerifiedAt,
    latestExecutionStatus,
  };
}

function classifyConfigUrl(value?: string): { configUrlMode: N8nWorkflowConfigMode; configUrlHost: string | null } {
  if (!value || value.includes("REPLACE_WITH_")) {
    return { configUrlMode: "placeholder", configUrlHost: null };
  }

  try {
    const url = new URL(value);
    const temporaryHosts = ["lhr.life", "loca.lt", "ngrok-free.app", "localhost", "127.0.0.1"];
    const isTemporary = temporaryHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));

    return {
      configUrlMode: isTemporary ? "temporary_tunnel" : "stable",
      configUrlHost: url.hostname,
    };
  } catch {
    return { configUrlMode: "unknown", configUrlHost: null };
  }
}

function workflowConfigUrl(workflow: N8nWorkflowResponse) {
  const assignments = workflow.nodes
    ?.flatMap((node) => node.parameters?.assignments?.assignments ?? [])
    .filter((assignment) => assignment.name && CONFIG_URL_ASSIGNMENTS.has(assignment.name));

  return assignments?.[0]?.value;
}

export async function getN8nWorkflowReadiness(): Promise<N8nWorkflowReadiness[]> {
  const config = getN8nConfig();

  if (!config) {
    return staticWorkflows("Set N8N_URL and N8N_API_KEY to enable live n8n status.");
  }

  try {
    return await Promise.all(
      n8nWorkflowReadiness.map(async (workflow) => {
        const [workflowResponse, executionsResponse] = await Promise.all([
          fetchJson<N8nWorkflowResponse>(`${config.url}/api/v1/workflows/${workflow.workflowId}`, config.apiKey),
          fetchJson<N8nExecutionResponse>(
            `${config.url}/api/v1/executions?workflowId=${workflow.workflowId}&limit=1`,
            config.apiKey,
          ),
        ]);
        const execution = executionsResponse.data?.[0];
        const evidence = executionEvidence(workflow, execution);
        const configUrl = workflowConfigUrl(workflowResponse);
        const configUrlState = classifyConfigUrl(configUrl);
        const requiredConfig = new Set(workflow.requiredConfig);

        if (configUrlState.configUrlMode === "placeholder") {
          requiredConfig.add(workflow.id === "internal-tools-failure-alert" ? "alertWebhookUrl" : "stableToolUrl");
        }

        return {
          ...workflow,
          status: workflowResponse.active ? "active" : "config_required",
          statusSource: "live",
          requiredConfig: Array.from(requiredConfig),
          lastEvidence: evidence.lastEvidence,
          lastVerifiedAt: evidence.lastVerifiedAt,
          latestExecutionStatus: evidence.latestExecutionStatus,
          liveError: null,
          configUrlMode: configUrlState.configUrlMode,
          configUrlHost: configUrlState.configUrlHost,
        };
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read live n8n status.";
    return staticWorkflows(message);
  }
}
