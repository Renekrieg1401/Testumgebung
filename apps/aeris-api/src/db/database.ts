// process.getBuiltinModule() statt eines statischen `import ... from 'node:sqlite'`,
// da Vite/Vitest node:sqlite (Node 22, experimentell) noch nicht in seiner
// Builtin-Modulliste kennt und den statischen Import sonst fälschlich zu bündeln versucht.
const sqlite = process.getBuiltinModule('node:sqlite');
const { DatabaseSync } = sqlite;

export type Database = InstanceType<typeof DatabaseSync>;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS vault_envelopes (
    account_id TEXT PRIMARY KEY,
    envelope_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS assessment_envelopes (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    envelope_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

export function openDatabase(path: string): Database {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  return db;
}

/** Enge Typprüfung an der DB-I/O-Grenze — node:sqlite typisiert Spalten breit als SQLOutputValue. */
export function asJsonColumn(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('Erwartete Textspalte enthält keinen String.');
  }
  return value;
}
