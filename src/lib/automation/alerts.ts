import { mkdir, readFile, writeFile } from "fs/promises";
import os from "os";
import path from "path";

export type AutomationAlertInput = {
  event?: unknown;
  sourceTool?: unknown;
  version?: unknown;
  requestId?: unknown;
  occurredAt?: unknown;
  actor?: unknown;
  data?: unknown;
};

export type AutomationAlertRecord = {
  id: string;
  event: string;
  sourceTool: string;
  version: "1.0";
  requestId: string;
  occurredAt: string;
  receivedAt: string;
  actor: {
    type: string;
    id?: string;
    name?: string;
  };
  workflowId: string | null;
  workflowName: string | null;
  executionId: string | null;
  executionUrl: string | null;
  errorMessage: string;
  lastNodeExecuted: string | null;
  mode: string | null;
  raw: AutomationAlertInput;
};

const MAX_ALERTS = 100;
const N8N_TIMEOUT_MS = 8_000;

function alertsFilePath() {
  return path.join(os.tmpdir(), "romega-orgchart-automation-alerts.json");
}

function n8nAuditConfig() {
  const url = process.env.N8N_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.N8N_API_KEY?.trim();
  const tableId = process.env.N8N_AUDIT_TABLE_ID?.trim();

  if (!url || !apiKey || !tableId) return null;

  return { url, apiKey, tableId };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringOrFallback(value: unknown, fallback: string): string {
  return stringOrNull(value) ?? fallback;
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function actorRecord(value: unknown): AutomationAlertRecord["actor"] {
  const actor = objectRecord(value);
  return {
    type: stringOrFallback(actor.type, "n8n"),
    id: stringOrNull(actor.id) ?? undefined,
    name: stringOrNull(actor.name) ?? undefined,
  };
}

function parseDate(value: unknown, fallback: string): string {
  const dateValue = stringOrNull(value);
  if (!dateValue) return fallback;

  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

export function normalizeAutomationAlert(input: AutomationAlertInput): AutomationAlertRecord {
  const now = new Date().toISOString();
  const data = objectRecord(input.data);
  const requestId = stringOrFallback(input.requestId, `n8n_error_${Date.now()}`);
  const event = stringOrFallback(input.event, "internal_tools.workflow_failed");
  const errorMessage = stringOrFallback(data.errorMessage, "Workflow execution failed.");

  return {
    id: `${requestId}_${Date.now()}`,
    event,
    sourceTool: stringOrFallback(input.sourceTool, "n8n"),
    version: "1.0",
    requestId,
    occurredAt: parseDate(input.occurredAt, now),
    receivedAt: now,
    actor: actorRecord(input.actor),
    workflowId: stringOrNull(data.workflowId),
    workflowName: stringOrNull(data.workflowName),
    executionId: stringOrNull(data.executionId),
    executionUrl: stringOrNull(data.executionUrl),
    errorMessage,
    lastNodeExecuted: stringOrNull(data.lastNodeExecuted),
    mode: stringOrNull(data.mode),
    raw: input,
  };
}

export async function readAutomationAlerts(limit = 20): Promise<AutomationAlertRecord[]> {
  const n8nAlerts = await readN8nAutomationAlerts(limit);
  if (n8nAlerts) return n8nAlerts;

  try {
    const raw = await readFile(alertsFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.slice(0, Math.min(Math.max(limit, 1), MAX_ALERTS)) as AutomationAlertRecord[];
  } catch (error) {
    const code = error && typeof error === "object" ? (error as { code?: string }).code : null;
    if (code === "ENOENT") return [];
    return [];
  }
}

export async function appendAutomationAlert(
  alert: AutomationAlertRecord,
): Promise<{ alerts: AutomationAlertRecord[]; durable: boolean; storage: "n8n_data_table" | "local_json_file" }> {
  const existing = await readAutomationAlerts(MAX_ALERTS);
  const nextAlerts = [alert, ...existing].slice(0, MAX_ALERTS);
  const filePath = alertsFilePath();

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(nextAlerts, null, 2), "utf8");

  const durable = await appendN8nAutomationAlert(alert);

  return {
    alerts: nextAlerts,
    durable,
    storage: durable ? "n8n_data_table" : "local_json_file",
  };
}

function toN8nAuditRow(alert: AutomationAlertRecord) {
  return {
    eventId: alert.id,
    tool: "org-chart",
    event: alert.event,
    requestId: alert.requestId,
    status: "failed",
    receivedAt: alert.receivedAt,
    summary: alert.workflowName || alert.errorMessage,
    payload: JSON.stringify(alert),
  };
}

async function appendN8nAutomationAlert(alert: AutomationAlertRecord): Promise<boolean> {
  const config = n8nAuditConfig();
  if (!config) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.url}/api/v1/data-tables/${config.tableId}/rows`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-N8N-API-KEY": config.apiKey,
      },
      body: JSON.stringify({ data: [toN8nAuditRow(alert)], returnType: "all" }),
      signal: controller.signal,
      cache: "no-store",
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function readN8nAutomationAlerts(limit: number): Promise<AutomationAlertRecord[] | null> {
  const config = n8nAuditConfig();
  if (!config) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

  try {
    const url = new URL(`${config.url}/api/v1/data-tables/${config.tableId}/rows`);
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), MAX_ALERTS)));
    url.searchParams.set("search", "org-chart");

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-N8N-API-KEY": config.apiKey,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) return null;

    const body = (await response.json()) as { data?: Array<{ payload?: unknown; tool?: unknown }> };
    const rows = Array.isArray(body.data) ? body.data : [];

    return rows
      .filter((row) => row.tool === "org-chart" && typeof row.payload === "string")
      .map((row) => {
        try {
          return JSON.parse(row.payload as string) as AutomationAlertRecord;
        } catch {
          return null;
        }
      })
      .filter((alert): alert is AutomationAlertRecord => Boolean(alert))
      .slice(0, Math.min(Math.max(limit, 1), MAX_ALERTS));
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
