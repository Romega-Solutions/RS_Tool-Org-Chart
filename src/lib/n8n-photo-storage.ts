const N8N_TIMEOUT_MS = 10_000;
const N8N_ROW_LIMIT = 250;

type FetchLike = typeof fetch;

export type N8nPhotoAsset = {
  filename: string;
  contentType: string;
  bytes: Buffer;
  size: number;
  rowId?: number | string;
};

type PhotoRow = {
  id?: number | string;
  filename?: unknown;
  contentType?: unknown;
  dataBase64?: unknown;
  size?: unknown;
};

function cleanEnvValue(value?: string) {
  return (value ?? "").replace(/\r|\n|\\r|\\n/g, "").trim();
}

function n8nPhotoConfig() {
  const url = cleanEnvValue(process.env.N8N_URL).replace(/\/+$/, "");
  const apiKey = cleanEnvValue(process.env.N8N_API_KEY);
  const tableId = cleanEnvValue(process.env.N8N_ORG_CHART_PHOTO_TABLE_ID);

  if (!url || !apiKey || !tableId) return null;

  return { url, apiKey, tableId };
}

export function isN8nPhotoStorageConfigured() {
  return Boolean(n8nPhotoConfig());
}

function filenameFilter(filename: string) {
  return {
    type: "and",
    filters: [{ columnName: "filename", condition: "eq", value: filename }],
  };
}

function parseRows(payload: unknown): PhotoRow[] {
  if (Array.isArray(payload)) return payload as PhotoRow[];
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: PhotoRow[] }).data;
  }

  return [];
}

function rowToAsset(row: PhotoRow): N8nPhotoAsset | null {
  const filename = typeof row.filename === "string" ? row.filename : "";
  const dataBase64 = typeof row.dataBase64 === "string" ? row.dataBase64 : "";
  if (!filename || !dataBase64) return null;

  const bytes = Buffer.from(dataBase64, "base64");
  return {
    filename,
    contentType: typeof row.contentType === "string" && row.contentType ? row.contentType : "image/webp",
    bytes,
    size: Number(row.size) || bytes.length,
    rowId: row.id,
  };
}

async function n8nFetchJson(path: string, init: RequestInit = {}, fetchImpl: FetchLike = fetch) {
  const config = n8nPhotoConfig();
  if (!config) {
    throw new Error("N8N_ORG_CHART_PHOTO_TABLE_ID, N8N_URL, and N8N_API_KEY are required for n8n photo storage.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${config.url}/api/v1/data-tables/${config.tableId}${path}`, {
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
      throw new Error(`n8n photo request ${path} failed with HTTP ${response.status}: ${body.slice(0, 500)}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function listN8nPhotos(fetchImpl?: FetchLike) {
  const payload = await n8nFetchJson(`/rows?limit=${N8N_ROW_LIMIT}`, undefined, fetchImpl);
  return parseRows(payload)
    .map(rowToAsset)
    .filter((asset): asset is N8nPhotoAsset => Boolean(asset))
    .sort((a, b) => b.filename.localeCompare(a.filename));
}

export async function getN8nPhoto(filename: string, fetchImpl?: FetchLike) {
  const payload = await n8nFetchJson(
    `/rows?limit=${N8N_ROW_LIMIT}&search=${encodeURIComponent(filename)}`,
    undefined,
    fetchImpl,
  );
  return (
    parseRows(payload)
      .map(rowToAsset)
      .filter((asset): asset is N8nPhotoAsset => Boolean(asset))
      .find((asset) => asset.filename === filename) ?? null
  );
}

export async function saveN8nPhoto(
  input: { filename: string; contentType: string; bytes: Buffer },
  fetchImpl?: FetchLike,
) {
  const payload = await n8nFetchJson(
    "/rows",
    {
      method: "POST",
      body: JSON.stringify({
        data: [
          {
            filename: input.filename,
            contentType: input.contentType,
            dataBase64: input.bytes.toString("base64"),
            size: String(input.bytes.length),
          },
        ],
        returnType: "all",
      }),
    },
    fetchImpl,
  );
  const [row] = parseRows(payload);
  const asset = rowToAsset(row);
  if (!asset) throw new Error("n8n did not return saved photo.");
  return asset;
}

export async function deleteN8nPhoto(filename: string, fetchImpl?: FetchLike) {
  const filter = encodeURIComponent(JSON.stringify(filenameFilter(filename)));
  await n8nFetchJson(
    `/rows/delete?filter=${filter}`,
    {
      method: "DELETE",
    },
    fetchImpl,
  );
}
