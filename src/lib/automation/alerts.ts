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

function alertsFilePath() {
  return path.join(os.tmpdir(), "romega-orgchart-automation-alerts.json");
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

export async function appendAutomationAlert(alert: AutomationAlertRecord): Promise<AutomationAlertRecord[]> {
  const existing = await readAutomationAlerts(MAX_ALERTS);
  const nextAlerts = [alert, ...existing].slice(0, MAX_ALERTS);
  const filePath = alertsFilePath();

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(nextAlerts, null, 2), "utf8");

  return nextAlerts;
}
