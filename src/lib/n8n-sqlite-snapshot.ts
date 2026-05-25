import fs from "fs/promises";
import path from "path";

const N8N_TIMEOUT_MS = 10_000;
const N8N_ROW_LIMIT = 250;
const SNAPSHOT_KEY = "orgchart-db";

type FetchLike = typeof fetch;

type SnapshotRow = {
  snapshotKey?: unknown;
  dataBase64?: unknown;
  size?: unknown;
  snapshotUpdatedAt?: unknown;
};

function cleanEnvValue(value?: string) {
  return (value ?? "").replace(/\r|\n|\\r|\\n/g, "").trim();
}

function n8nSnapshotConfig() {
  const url = cleanEnvValue(process.env.N8N_URL).replace(/\/+$/, "");
  const apiKey = cleanEnvValue(process.env.N8N_API_KEY);
  const tableId = cleanEnvValue(process.env.N8N_ORG_CHART_DB_SNAPSHOT_TABLE_ID);

  if (!url || !apiKey || !tableId) return null;

  return { url, apiKey, tableId };
}

export function isN8nSqliteSnapshotConfigured() {
  return Boolean(n8nSnapshotConfig());
}

function snapshotFilter() {
  return {
    type: "and",
    filters: [{ columnName: "snapshotKey", condition: "eq", value: SNAPSHOT_KEY }],
  };
}

function parseRows(payload: unknown): SnapshotRow[] {
  if (Array.isArray(payload)) return payload as SnapshotRow[];
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: SnapshotRow[] }).data;
  }

  return [];
}

async function n8nFetchJson(pathname: string, init: RequestInit = {}, fetchImpl: FetchLike = fetch) {
  const config = n8nSnapshotConfig();
  if (!config) {
    throw new Error(
      "N8N_ORG_CHART_DB_SNAPSHOT_TABLE_ID, N8N_URL, and N8N_API_KEY are required for n8n SQLite snapshot storage.",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${config.url}/api/v1/data-tables/${config.tableId}${pathname}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-N8N-API-KEY": config.apiKey,
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`n8n SQLite snapshot request ${pathname} failed with HTTP ${response.status}: ${body.slice(0, 500)}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function newestSnapshot(rows: SnapshotRow[]) {
  return rows
    .filter((row) => row.snapshotKey === SNAPSHOT_KEY && typeof row.dataBase64 === "string")
    .sort((a, b) => String(b.snapshotUpdatedAt ?? "").localeCompare(String(a.snapshotUpdatedAt ?? "")))[0] ?? null;
}

export async function restoreN8nSqliteSnapshot(dbPath: string, fetchImpl?: FetchLike) {
  if (!isN8nSqliteSnapshotConfigured()) return false;

  const payload = await n8nFetchJson(`/rows?limit=${N8N_ROW_LIMIT}&search=${encodeURIComponent(SNAPSHOT_KEY)}`, undefined, fetchImpl);
  const snapshot = newestSnapshot(parseRows(payload));
  if (!snapshot || typeof snapshot.dataBase64 !== "string") return false;

  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  await fs.writeFile(dbPath, Buffer.from(snapshot.dataBase64, "base64"));
  return true;
}

export async function persistN8nSqliteSnapshot(dbPath: string, fetchImpl?: FetchLike) {
  if (!isN8nSqliteSnapshotConfigured()) return false;

  const bytes = await fs.readFile(dbPath);
  const snapshotUpdatedAt = new Date().toISOString();
  const filter = encodeURIComponent(JSON.stringify(snapshotFilter()));

  await n8nFetchJson(
    `/rows/delete?filter=${filter}`,
    {
      method: "DELETE",
    },
    fetchImpl,
  );

  await n8nFetchJson(
    "/rows",
    {
      method: "POST",
      body: JSON.stringify({
        data: [
          {
            snapshotKey: SNAPSHOT_KEY,
            dataBase64: bytes.toString("base64"),
            size: String(bytes.length),
            snapshotUpdatedAt,
          },
        ],
        returnType: "all",
      }),
    },
    fetchImpl,
  );

  return true;
}
