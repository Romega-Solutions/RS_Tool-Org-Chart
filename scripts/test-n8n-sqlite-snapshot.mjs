import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const modulePath = new URL("../src/lib/n8n-sqlite-snapshot.ts", import.meta.url);

function withEnv(values, fn) {
  const previous = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    process.env[key] = values[key];
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

const env = {
  N8N_URL: "https://n8n.example",
  N8N_API_KEY: "secret",
  N8N_ORG_CHART_DB_SNAPSHOT_TABLE_ID: "snapshot-table",
};

test("n8n sqlite snapshot restores the newest snapshot file", async () => {
  const { restoreN8nSqliteSnapshot } = await import(modulePath);
  const dir = await mkdtemp(path.join(tmpdir(), "orgchart-snapshot-"));
  const dbPath = path.join(dir, "orgchart.db");
  const calls = [];

  await withEnv(env, async () => {
    process.env.N8N_ORG_CHART_DB_SNAPSHOT_TABLE_ID = `${process.env.N8N_ORG_CHART_DB_SNAPSHOT_TABLE_ID}\\r\\n\r\n`;
    const restored = await restoreN8nSqliteSnapshot(dbPath, async (url) => {
      calls.push(url);
      return Response.json([
        {
          snapshotKey: "orgchart-db",
          dataBase64: Buffer.from("sqlite-bytes").toString("base64"),
          size: "12",
          snapshotUpdatedAt: "2026-05-25T00:00:00.000Z",
        },
      ]);
    });

    assert.equal(restored, true);
    assert.equal(await readFile(dbPath, "utf8"), "sqlite-bytes");
    assert.equal(
      calls[0],
      "https://n8n.example/api/v1/data-tables/snapshot-table/rows?limit=250&search=orgchart-db",
    );
  });

  await rm(dir, { recursive: true, force: true });
});

test("n8n sqlite snapshot persists by replacing the snapshot row", async () => {
  const { persistN8nSqliteSnapshot } = await import(modulePath);
  const dir = await mkdtemp(path.join(tmpdir(), "orgchart-snapshot-"));
  const dbPath = path.join(dir, "orgchart.db");
  const calls = [];

  await writeFile(dbPath, "sqlite-bytes");

  await withEnv(env, async () => {
    await persistN8nSqliteSnapshot(dbPath, async (url, init) => {
      calls.push({ url, init });
      return Response.json(url.includes("/rows/delete") ? true : [{ snapshotKey: "orgchart-db" }]);
    });

    assert.equal(
      calls[0].url,
      'https://n8n.example/api/v1/data-tables/snapshot-table/rows/delete?filter=%7B%22type%22%3A%22and%22%2C%22filters%22%3A%5B%7B%22columnName%22%3A%22snapshotKey%22%2C%22condition%22%3A%22eq%22%2C%22value%22%3A%22orgchart-db%22%7D%5D%7D',
    );
    assert.equal(calls[0].init.method, "DELETE");
    assert.equal(calls[1].url, "https://n8n.example/api/v1/data-tables/snapshot-table/rows");
    const body = JSON.parse(calls[1].init.body);
    assert.equal(body.data[0].snapshotKey, "orgchart-db");
    assert.equal(body.data[0].dataBase64, Buffer.from("sqlite-bytes").toString("base64"));
    assert.equal(body.data[0].size, "12");
    assert.match(body.data[0].snapshotUpdatedAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  await rm(dir, { recursive: true, force: true });
});
