import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

let database;
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export function getDatabase() {
  if (database) {
    return database;
  }

  const configuredFile = process.env.DATABASE_FILE || "./data/ai-capsule.db";
  const databaseFile =
    configuredFile === ":memory:"
      ? configuredFile
      : path.resolve(currentDirectory, "..", configuredFile);

  // SQLite needs the folder to exist before it can create the database file.
  if (databaseFile !== ":memory:") {
    fs.mkdirSync(path.dirname(databaseFile), { recursive: true });
  }

  database = new DatabaseSync(databaseFile);
  database.exec("PRAGMA foreign_keys = ON;");

  return database;
}

export function initializeDatabase() {
  const db = getDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS capsules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      project_name TEXT NOT NULL,
      prompt_title TEXT NOT NULL,
      prompt_version TEXT,
      prompt_text TEXT NOT NULL,
      response_summary TEXT,
      category TEXT,
      usefulness TEXT,
      reviewed INTEGER NOT NULL DEFAULT 0 CHECK (reviewed IN (0, 1)),
      improved INTEGER NOT NULL DEFAULT 0 CHECK (improved IN (0, 1)),
      screenshot_url TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export function closeDatabase() {
  if (database) {
    database.close();
    database = undefined;
  }
}
