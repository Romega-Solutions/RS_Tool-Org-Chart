import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";
import os from "os";
import { persistN8nSqliteSnapshot, restoreN8nSqliteSnapshot } from "@/lib/n8n-sqlite-snapshot";

const dataDir = process.env.ORGCHART_DB_DIR
  ? path.resolve(process.env.ORGCHART_DB_DIR)
  : process.env.VERCEL
    ? path.join(os.tmpdir(), "romega-orgchart")
    : path.join(process.cwd(), "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "orgchart.db");

if (!fs.existsSync(dbPath)) {
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
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      department_id INTEGER NOT NULL REFERENCES departments(id),
      reports_to INTEGER,
      photo_url TEXT,
      email TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      employment_type TEXT,
      project_ids TEXT
    );
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
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      entity_name TEXT,
      actor TEXT,
      changes TEXT
    );
  `);

  const peopleColumns = sqlite.prepare("PRAGMA table_info(people)").all();
  const hasEmailColumn = peopleColumns.some((column) => (column as { name?: string }).name === "email");
  if (!hasEmailColumn) {
    sqlite.exec("ALTER TABLE people ADD COLUMN email TEXT");
  }
}

initDb();

// Seed default data (settings + org structure) on first run
void import("./seed");
