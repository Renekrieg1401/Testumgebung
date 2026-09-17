import { beforeEach, describe, expect, it } from 'vitest';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createVault } from '@aeris/crypto-core';
import type { Argon2idParams } from '@aeris/crypto-core';
import { createAerisDatabase, type AerisDatabase } from '../lib/db/database.js';
import { createAssessment, listAssessments } from '../lib/assessments/service.js';

// Minimale KDF-Kosten ausschließlich für Testläufe.
const FAST_TEST_PARAMS: Argon2idParams = {
  algorithm: 'argon2id',
  iterations: 1,
  memoryKiB: 1024,
  parallelism: 1,
};

async function createTestDatabase(): Promise<AerisDatabase> {
  const name = `test-${crypto.randomUUID()}`;
  return createAerisDatabase(name, getRxStorageMemory());
}

describe('Assessment-Service (Offline-First, Zero-Knowledge)', () => {
  let db: AerisDatabase;
  const accountId = '44444444-4444-4444-4444-444444444444';
  const deviceId = 'test-device-1';

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  it('speichert eine Antwort verschlüsselt lokal und liest sie entschlüsselt zurück', async () => {
    const { dek } = await createVault('correct horse battery staple', FAST_TEST_PARAMS);
    await createAssessment(db, dek, accountId, deviceId, {
      belastung: 7,
      erschoepfung: 6,
      selbstsorge: 3,
    });

    const summaries = await listAssessments(db, dek, accountId);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.answers).toEqual({ belastung: 7, erschoepfung: 6, selbstsorge: 3 });
  });

  it('speichert den Ciphertext, niemals den Klartext, in der lokalen Datenbank', async () => {
    const { dek } = await createVault('correct horse battery staple', FAST_TEST_PARAMS);
    await createAssessment(db, dek, accountId, deviceId, { belastung: 9, erschoepfung: 8, selbstsorge: 1 });

    const rawDocs = await db.assessments.find().exec();
    expect(rawDocs).toHaveLength(1);
    expect(rawDocs[0]?.encryptedPayloadJson).not.toContain('"belastung":9');
  });

  it('trennt Assessments verschiedener Accounts', async () => {
    const { dek } = await createVault('correct horse battery staple', FAST_TEST_PARAMS);
    await createAssessment(db, dek, accountId, deviceId, { belastung: 5, erschoepfung: 5, selbstsorge: 5 });

    const otherAccountId = '55555555-5555-5555-5555-555555555555';
    const summaries = await listAssessments(db, dek, otherAccountId);

    expect(summaries).toHaveLength(0);
  });
});
