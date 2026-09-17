import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AssessmentSyncEnvelopeSchema, VaultEnvelopeSchema } from '@aeris/shared-schemas';
import { buildApp } from '../src/app';

const ProblemResponseSchema = z.object({ status: z.number() });
const VaultResponseSchema = z.object({ envelope: VaultEnvelopeSchema });
const AssessmentResponseSchema = z.object({ envelope: AssessmentSyncEnvelopeSchema });
const AssessmentListResponseSchema = z.object({ envelopes: z.array(AssessmentSyncEnvelopeSchema) });

function createTestApp(): ReturnType<typeof buildApp> {
  return buildApp({ databasePath: ':memory:', logger: false });
}

describe('AERIS API', () => {
  it('/health antwortet mit status ok', async () => {
    const app = createTestApp();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('registriert und liest ein VaultEnvelope', async () => {
    const app = createTestApp();
    const accountId = '11111111-1111-1111-1111-111111111111';
    const envelope = {
      version: 1,
      salt: 'AAAA',
      kdf: { algorithm: 'argon2id', iterations: 3, memoryKiB: 65536, parallelism: 1 },
      wrappedDek: { algorithm: 'AES-256-GCM', iv: 'AAAA', ciphertext: 'AAAA' },
    };

    const postResponse = await app.inject({
      method: 'POST',
      url: '/v1/vault',
      payload: { accountId, envelope },
    });
    expect(postResponse.statusCode).toBe(201);

    const getResponse = await app.inject({ method: 'GET', url: `/v1/vault/${accountId}` });
    expect(getResponse.statusCode).toBe(200);
    expect(VaultResponseSchema.parse(getResponse.json())).toEqual({ envelope });

    await app.close();
  });

  it('liefert RFC-7807 problem+json für einen unbekannten Vault', async () => {
    const app = createTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/vault/22222222-2222-2222-2222-222222222222',
    });
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(ProblemResponseSchema.parse(response.json()).status).toBe(404);
    await app.close();
  });

  it('liefert RFC-7807 problem+json für ungültige Eingaben', async () => {
    const app = createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/vault',
      payload: { accountId: 'keine-uuid' },
    });
    expect(response.statusCode).toBe(422);
    expect(ProblemResponseSchema.parse(response.json()).status).toBe(422);
    await app.close();
  });

  it('löst Konflikte zwischen zwei Geräten deterministisch über die Vektoruhr auf', async () => {
    const app = createTestApp();
    const base = {
      id: '33333333-3333-3333-3333-333333333333',
      accountId: '11111111-1111-1111-1111-111111111111',
      encryptedPayload: { algorithm: 'AES-256-GCM' as const, iv: 'AAAA', ciphertext: 'AAAA' },
    };

    await app.inject({
      method: 'POST',
      url: '/v1/assessments',
      payload: { ...base, vectorClock: { 'device-a': 1 }, updatedAt: '2026-01-01T00:00:00.000Z' },
    });
    const secondResponse = await app.inject({
      method: 'POST',
      url: '/v1/assessments',
      payload: { ...base, vectorClock: { 'device-a': 2 }, updatedAt: '2026-01-02T00:00:00.000Z' },
    });

    expect(AssessmentResponseSchema.parse(secondResponse.json()).envelope.vectorClock).toEqual({
      'device-a': 2,
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: `/v1/assessments/${base.accountId}`,
    });
    expect(AssessmentListResponseSchema.parse(listResponse.json()).envelopes).toHaveLength(1);

    await app.close();
  });
});
