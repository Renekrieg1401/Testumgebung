import { resolveAssessmentConflict, type AssessmentSyncEnvelope } from '@aeris/shared-schemas';
import { asJsonColumn, type Database } from '../db/database';

export interface AssessmentRepository {
  upsertWithConflictResolution(incoming: AssessmentSyncEnvelope): AssessmentSyncEnvelope;
  listByAccountId(accountId: string): AssessmentSyncEnvelope[];
}

export function createSqliteAssessmentRepository(db: Database): AssessmentRepository {
  const selectByIdStatement = db.prepare('SELECT envelope_json FROM assessment_envelopes WHERE id = ?');
  const upsertStatement = db.prepare(`
    INSERT INTO assessment_envelopes (id, account_id, envelope_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET envelope_json = excluded.envelope_json, updated_at = excluded.updated_at
  `);
  const selectByAccountIdStatement = db.prepare(
    'SELECT envelope_json FROM assessment_envelopes WHERE account_id = ? ORDER BY updated_at ASC',
  );

  function readExisting(id: string): AssessmentSyncEnvelope | undefined {
    const row = selectByIdStatement.get(id);
    return row ? (JSON.parse(asJsonColumn(row.envelope_json)) as AssessmentSyncEnvelope) : undefined;
  }

  return {
    upsertWithConflictResolution(incoming) {
      const existing = readExisting(incoming.id);
      const resolved = existing ? resolveAssessmentConflict(existing, incoming) : incoming;
      upsertStatement.run(resolved.id, resolved.accountId, JSON.stringify(resolved), resolved.updatedAt);
      return resolved;
    },
    listByAccountId(accountId) {
      const rows = selectByAccountIdStatement.all(accountId);
      return rows.map((row) => JSON.parse(asJsonColumn(row.envelope_json)) as AssessmentSyncEnvelope);
    },
  };
}
