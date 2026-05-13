import fs from "node:fs";
import path from "node:path";

const DEFAULT_BASE_URL = "https://tools.romega-solutions.com/org-chart";
const DEFAULT_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/161m2rlSDgZbstklDrlXZU87_0isWHJ2o3iLRVNUoW1A/export?format=csv&gid=947755283";
const DEFAULT_MCP_URL = "https://n8n-romega-n8n.ikuuwb.easypanel.host/mcp/rs-org-chart";

loadEnvFile(".env.local");

const baseUrl = stripTrailingSlash(process.env.ORGCHART_BASE_URL || DEFAULT_BASE_URL);
const sheetCsvUrl = process.env.ORGCHART_SHEET_CSV_URL || DEFAULT_SHEET_CSV_URL;
const mcpUrl = process.env.ORGCHART_MCP_URL || DEFAULT_MCP_URL;
const apiKey = process.env.ORGCHART_API_KEY || process.env.API_KEY || "";
const shouldProbeMcp = !process.argv.includes("--skip-mcp");

const checks = [];

try {
  await checkPublicRoute("/login", "Org Chart");

  if (apiKey) {
    await checkJson("/api/people?includeInactive=true", "people", { minItems: 1, apiKey });
    await checkJson("/api/departments", "departments", { minItems: 1, apiKey });
    await checkJson("/api/audit?limit=5&page=1", "audit", { apiKey, validator: validateAudit });
  } else {
    record("api-key", "warn", "API_KEY/ORGCHART_API_KEY is not set; skipped protected API checks.");
  }

  await checkSheetCsv();

  if (shouldProbeMcp) {
    await checkMcpEndpoint();
  }
} catch (error) {
  record("fatal", "fail", error instanceof Error ? error.message : String(error));
}

const failed = checks.filter((check) => check.status === "fail");
const warned = checks.filter((check) => check.status === "warn");

console.table(checks);

if (failed.length > 0) {
  console.error(`Weekly live QA failed: ${failed.length} failure(s), ${warned.length} warning(s).`);
  process.exit(1);
}

console.log(`Weekly live QA passed with ${warned.length} warning(s).`);

function loadEnvFile(filename) {
  const envPath = path.join(process.cwd(), filename);
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^"(.*)"$/, "$1");
  }
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

async function checkPublicRoute(route, expectedText) {
  const started = Date.now();
  const response = await fetch(`${baseUrl}${route}`, { redirect: "follow" });
  const body = await response.text();
  const ms = Date.now() - started;

  if (!response.ok || !body.includes(expectedText)) {
    record(route, "fail", `HTTP ${response.status}; expected text not found`, ms);
    return;
  }

  record(route, "pass", `HTTP ${response.status}`, ms);
}

async function checkJson(route, label, options = {}) {
  const started = Date.now();
  const headers = options.apiKey ? { "X-API-Key": options.apiKey } : undefined;
  const response = await fetch(`${baseUrl}${route}`, { headers });
  const ms = Date.now() - started;

  if (!response.ok) {
    record(label, "fail", `HTTP ${response.status}`, ms);
    return null;
  }

  const data = await response.json();

  if (options.minItems && (!Array.isArray(data) || data.length < options.minItems)) {
    record(label, "fail", `Expected at least ${options.minItems} item(s).`, ms);
    return data;
  }

  if (options.validator) {
    const validation = options.validator(data);
    if (validation !== true) {
      record(label, "fail", validation, ms);
      return data;
    }
  }

  const count = Array.isArray(data) ? data.length : data?.entries?.length ?? "ok";
  record(label, "pass", `HTTP ${response.status}; count=${count}`, ms);
  return data;
}

function validateAudit(data) {
  if (!data || !Array.isArray(data.entries)) return "Expected audit response with entries array.";
  return true;
}

async function checkSheetCsv() {
  const started = Date.now();
  const response = await fetch(sheetCsvUrl, { redirect: "follow" });
  const body = await response.text();
  const ms = Date.now() - started;

  if (!response.ok) {
    record("sheet-csv", "fail", `HTTP ${response.status}`, ms);
    return;
  }

  const lines = body.trim().split(/\r?\n/).filter(Boolean);
  const header = lines[0] || "";
  const required = ["Name", "Role/Position", "Team"];
  const missing = required.filter((column) => !header.toLowerCase().includes(column.toLowerCase()));

  if (missing.length > 0 || lines.length <= 1) {
    record("sheet-csv", "fail", `Missing columns: ${missing.join(", ") || "none"}; rows=${Math.max(0, lines.length - 1)}`, ms);
    return;
  }

  record("sheet-csv", "pass", `rows=${lines.length - 1}`, ms);
}

async function checkMcpEndpoint() {
  const started = Date.now();
  const initializeBody = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "org-chart-weekly-live-qa", version: "1.0.0" },
    },
  };

  const response = await fetch(mcpUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(initializeBody),
  });

  if (response.status === 404) {
    const ms = Date.now() - started;
    record("n8n-mcp", "warn", "HTTP 404; production MCP webhook is not registered/active at configured URL.", ms);
    return;
  }

  if (!response.ok) {
    const ms = Date.now() - started;
    record("n8n-mcp", "fail", `HTTP ${response.status}`, ms);
    return;
  }

  const sessionId = response.headers.get("mcp-session-id");
  if (!sessionId) {
    const ms = Date.now() - started;
    record("n8n-mcp", "fail", `HTTP ${response.status}; missing Mcp-Session-Id`, ms);
    return;
  }

  await fetch(mcpUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Mcp-Session-Id": sessionId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    }),
  });

  const toolsResponse = await fetch(mcpUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Mcp-Session-Id": sessionId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }),
  });
  const ms = Date.now() - started;

  if (!toolsResponse.ok) {
    record("n8n-mcp", "fail", `tools/list HTTP ${toolsResponse.status}`, ms);
    return;
  }

  const text = await toolsResponse.text();
  const match = text.match(/^data:\s*(.+)$/m);
  const payload = match ? JSON.parse(match[1]) : null;
  const tools = payload?.result?.tools;

  if (!Array.isArray(tools) || tools.length === 0) {
    record("n8n-mcp", "fail", "tools/list returned no tools.", ms);
    return;
  }

  record("n8n-mcp", "pass", `HTTP ${response.status}; tools=${tools.length}`, ms);
}

function record(name, status, detail, ms = "") {
  checks.push({ name, status, detail, ms });
}
