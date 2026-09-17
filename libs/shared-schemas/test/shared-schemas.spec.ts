import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  AssessmentSyncEnvelopeSchema,
  compareVectorClocks,
  createProblemDetails,
  DomainError,
  notFoundError,
  resolveAssessmentConflict,
  validationProblemFromZodError,
  VaultEnvelopeSchema,
  type AssessmentSyncEnvelope,
} from '../src/index';

function makeEnvelope(overrides: Partial<AssessmentSyncEnvelope>): AssessmentSyncEnvelope {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    accountId: '22222222-2222-2222-2222-222222222222',
    encryptedPayload: { algorithm: 'AES-256-GCM', iv: 'AAAA', ciphertext: 'AAAA' },
    vectorClock: { 'device-a': 1 },
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('VaultEnvelopeSchema', () => {
  it('akzeptiert ein valides Envelope', () => {
    const result = VaultEnvelopeSchema.safeParse({
      version: 1,
      salt: 'AAAA',
      kdf: { algorithm: 'argon2id', iterations: 3, memoryKiB: 65536, parallelism: 1 },
      wrappedDek: { algorithm: 'AES-256-GCM', iv: 'AAAA', ciphertext: 'AAAA' },
    });
    expect(result.success).toBe(true);
  });

  it('lehnt einen Klartext-DEK-Versuch ab (fehlendes Feld)', () => {
    const result = VaultEnvelopeSchema.safeParse({ version: 1, salt: 'AAAA' });
    expect(result.success).toBe(false);
  });
});

describe('compareVectorClocks', () => {
  it('erkennt kausale Ordnung "after"', () => {
    expect(compareVectorClocks({ a: 2 }, { a: 1 })).toBe('after');
  });

  it('erkennt Nebenläufigkeit', () => {
    expect(compareVectorClocks({ a: 2, b: 0 }, { a: 1, b: 1 })).toBe('concurrent');
  });
});

describe('resolveAssessmentConflict', () => {
  it('wählt bei kausaler Ordnung die neuere Version', () => {
    const older = makeEnvelope({ vectorClock: { 'device-a': 1 } });
    const newer = makeEnvelope({ vectorClock: { 'device-a': 2 } });
    expect(resolveAssessmentConflict(older, newer)).toBe(newer);
    expect(resolveAssessmentConflict(newer, older)).toBe(newer);
  });

  it('ist bei Nebenläufigkeit symmetrisch (konfliktfrei)', () => {
    const local = makeEnvelope({
      vectorClock: { 'device-a': 2, 'device-b': 0 },
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    const remote = makeEnvelope({
      vectorClock: { 'device-a': 1, 'device-b': 1 },
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(resolveAssessmentConflict(local, remote)).toBe(local);
    expect(resolveAssessmentConflict(remote, local)).toBe(local);
  });

  it('validiert die Sync-Envelope-Struktur per Zod', () => {
    const parsed = AssessmentSyncEnvelopeSchema.safeParse(makeEnvelope({}));
    expect(parsed.success).toBe(true);
  });
});

describe('RFC-7807 Problem Details', () => {
  it('erzeugt eine problem+json-konforme Struktur', () => {
    const problem = createProblemDetails({ slug: 'conflict', title: 'Konflikt', status: 409 });
    expect(problem.type).toBe('https://aeris.dipa.de/problems/conflict');
    expect(problem.status).toBe(409);
    expect(problem.detail).toBeUndefined();
  });

  it('leitet ein ProblemDetails aus einem ZodError ab', () => {
    const result = z.object({ name: z.string() }).safeParse({ name: 42 });
    if (result.success) throw new Error('Testannahme verletzt');
    const problem = validationProblemFromZodError(result.error);
    expect(problem.status).toBe(422);
    expect(problem.detail).toContain('name');
  });

  it('DomainError transportiert das ProblemDetails-Objekt', () => {
    const error = notFoundError('Assessment');
    expect(error).toBeInstanceOf(DomainError);
    expect(error.problem.status).toBe(404);
  });
});
