import { z } from 'zod';
import { EncryptedPayloadSchema } from './primitives.schema';

/**
 * Sync-Strategie für die Entität "Assessment": Last-Write-Wins mit
 * Vektoruhr. Jedes Gerät führt einen eigenen Zähler; beim Sync wird die
 * kausale Ordnung geprüft (siehe compareVectorClocks) und nur bei
 * echter Nebenläufigkeit auf den Zeitstempel zurückgefallen. Diese
 * Entscheidung ist konfliktfrei: beide Seiten kommen unabhängig vom
 * Anfrage-/Antwortpfad zum selben Ergebnis (siehe resolveAssessmentConflict).
 */
export const VectorClockSchema = z.record(z.string(), z.number().int().nonnegative());
export type VectorClock = z.infer<typeof VectorClockSchema>;

export const AssessmentSyncEnvelopeSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  encryptedPayload: EncryptedPayloadSchema,
  vectorClock: VectorClockSchema,
  updatedAt: z.string().datetime(),
});
export type AssessmentSyncEnvelope = z.infer<typeof AssessmentSyncEnvelopeSchema>;

export type ClockOrder = 'before' | 'after' | 'concurrent' | 'equal';

export function compareVectorClocks(a: VectorClock, b: VectorClock): ClockOrder {
  let aLess = false;
  let aGreater = false;
  for (const deviceId of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const aCount = a[deviceId] ?? 0;
    const bCount = b[deviceId] ?? 0;
    if (aCount < bCount) aLess = true;
    if (aCount > bCount) aGreater = true;
  }
  if (aLess && aGreater) return 'concurrent';
  if (aLess) return 'before';
  if (aGreater) return 'after';
  return 'equal';
}

/**
 * Deterministische, konfliktfreie Zusammenführung: liefert bei jeder
 * Aufrufreihenfolge (lokal↔remote) dasselbe Ergebnis.
 */
export function resolveAssessmentConflict(
  local: AssessmentSyncEnvelope,
  remote: AssessmentSyncEnvelope,
): AssessmentSyncEnvelope {
  const order = compareVectorClocks(local.vectorClock, remote.vectorClock);
  if (order === 'after' || order === 'equal') return local;
  if (order === 'before') return remote;
  return resolveConcurrent(local, remote);
}

function resolveConcurrent(
  local: AssessmentSyncEnvelope,
  remote: AssessmentSyncEnvelope,
): AssessmentSyncEnvelope {
  const localTime = Date.parse(local.updatedAt);
  const remoteTime = Date.parse(remote.updatedAt);
  if (localTime !== remoteTime) return localTime > remoteTime ? local : remote;
  return local.encryptedPayload.ciphertext > remote.encryptedPayload.ciphertext ? local : remote;
}
