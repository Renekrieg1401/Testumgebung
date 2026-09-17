import { z } from 'zod';
import {
  AssessmentSyncEnvelopeSchema,
  type AssessmentSyncEnvelope,
  type VaultEnvelope,
} from '@aeris/shared-schemas';

const API_BASE_URL = process.env.NEXT_PUBLIC_AERIS_API_URL ?? 'http://localhost:3333';

const PushAssessmentResponseSchema = z.object({ envelope: AssessmentSyncEnvelopeSchema });
const ListAssessmentsResponseSchema = z.object({ envelopes: z.array(AssessmentSyncEnvelopeSchema) });

async function postJson(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`AERIS-API-Anfrage fehlgeschlagen (Status ${String(response.status)}).`);
  }
  return response.json();
}

export async function pushVaultEnvelope(accountId: string, envelope: VaultEnvelope): Promise<void> {
  await postJson('/v1/vault', { accountId, envelope });
}

export async function pushAssessment(envelope: AssessmentSyncEnvelope): Promise<AssessmentSyncEnvelope> {
  const body = await postJson('/v1/assessments', envelope);
  return PushAssessmentResponseSchema.parse(body).envelope;
}

export async function fetchAssessments(accountId: string): Promise<AssessmentSyncEnvelope[]> {
  const response = await fetch(`${API_BASE_URL}/v1/assessments/${accountId}`);
  if (!response.ok) {
    throw new Error(`Assessment-Abruf fehlgeschlagen (Status ${String(response.status)}).`);
  }
  const body: unknown = await response.json();
  return ListAssessmentsResponseSchema.parse(body).envelopes;
}
