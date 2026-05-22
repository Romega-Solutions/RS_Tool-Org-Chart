import { n8nWorkflowReadiness, type N8nWorkflowReadiness } from "./n8n-workflows";

type N8nWorkflowResponse = {
  active?: boolean;
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

        return {
          ...workflow,
          status: workflowResponse.active ? "active" : "config_required",
          statusSource: "live",
          lastEvidence: evidence.lastEvidence,
          lastVerifiedAt: evidence.lastVerifiedAt,
          latestExecutionStatus: evidence.latestExecutionStatus,
          liveError: null,
        };
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read live n8n status.";
    return staticWorkflows(message);
  }
}
