import type BetterSqlite3 from "better-sqlite3";

export function getDb(): BetterSqlite3.Database {
  // Use the global DB instance set by server.js
  const db = (global as Record<string, unknown>).db as BetterSqlite3.Database | undefined;
  if (!db) {
    throw new Error("Database not initialized — server.js must set global.db");
  }
  return db;
}
