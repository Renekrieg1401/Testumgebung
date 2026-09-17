import type { VaultEnvelope } from '@aeris/shared-schemas';
import { asJsonColumn, type Database } from '../db/database';

export interface VaultRepository {
  save(accountId: string, envelope: VaultEnvelope): void;
  findByAccountId(accountId: string): VaultEnvelope | undefined;
}

export function createSqliteVaultRepository(db: Database): VaultRepository {
  const upsertStatement = db.prepare(`
    INSERT INTO vault_envelopes (account_id, envelope_json, created_at)
    VALUES (?, ?, ?)
    ON CONFLICT(account_id) DO UPDATE SET envelope_json = excluded.envelope_json
  `);
  const selectByAccountIdStatement = db.prepare(
    'SELECT envelope_json FROM vault_envelopes WHERE account_id = ?',
  );

  return {
    save(accountId, envelope) {
      upsertStatement.run(accountId, JSON.stringify(envelope), new Date().toISOString());
    },
    findByAccountId(accountId) {
      const row = selectByAccountIdStatement.get(accountId);
      if (!row) return undefined;
      return JSON.parse(asJsonColumn(row.envelope_json)) as VaultEnvelope;
    },
  };
}
