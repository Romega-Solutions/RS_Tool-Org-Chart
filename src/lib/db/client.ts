import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";
import os from "os";
import { persistN8nSqliteSnapshot, restoreN8nSqliteSnapshot } from "@/lib/n8n-sqlite-snapshot";

const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";

const dataDir = process.env.ORGCHART_DB_DIR
  ? path.resolve(process.env.ORGCHART_DB_DIR)
  : isProductionBuild
    ? path.join(os.tmpdir(), `romega-orgchart-build-${process.pid}`)
  : process.env.VERCEL
    ? path.join(os.tmpdir(), "romega-orgchart")
    : path.join(process.cwd(), "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "orgchart.db");

if (!fs.existsSync(dbPath) && !isProductionBuild) {
  try {
    await restoreN8nSqliteSnapshot(dbPath);
  } catch (error) {
    console.warn("[orgchart] Could not restore n8n SQLite snapshot:", error);
  }
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

let snapshotQueue: Promise<boolean> = Promise.resolve(false);

export function getOrgChartDbPath() {
  return dbPath;
}

export function persistOrgChartDbSnapshot(reason = "mutation") {
  snapshotQueue = snapshotQueue
    .catch(() => false)
    .then(async () => {
      try {
        sqlite.pragma("wal_checkpoint(TRUNCATE)");
        return await persistN8nSqliteSnapshot(dbPath);
      } catch (error) {
        console.warn(`[orgchart] Could not persist n8n SQLite snapshot after ${reason}:`, error);
        return false;
      }
    });

  return snapshotQueue;
}

export function initDb() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

initDb();

// Seed default settings and accounts on first run
void import("./seed");
