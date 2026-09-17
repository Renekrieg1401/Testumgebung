import type { RxDocument } from 'rxdb';
import type { z } from 'zod';
import { decryptField, encryptField } from '@aeris/crypto-core';
import {
  EncryptedPayloadSchema,
  VectorClockSchema,
  type AssessmentSyncEnvelope,
  type VectorClock,
} from '@aeris/shared-schemas';
import { toFhirQuestionnaireResponse, type DecryptedAssessment } from '@aeris/fhir-export';
import type { AerisDatabase } from '../db/database';
import type { AssessmentDocType } from '../db/schema';
import { pushAssessment } from '../api/client';
import { ASSESSMENT_QUESTIONS, AssessmentAnswersSchema, CARE_BURDEN_QUESTIONNAIRE_URL } from './model';
import type { AssessmentAnswers } from './model';

export interface AssessmentSummary {
  readonly id: string;
  readonly authoredAt: string;
  readonly answers: AssessmentAnswers;
}

function incrementVectorClock(current: VectorClock, deviceId: string): VectorClock {
  return { ...current, [deviceId]: (current[deviceId] ?? 0) + 1 };
}

function parseJson<T>(text: string, schema: z.ZodType<T>): T {
  return schema.parse(JSON.parse(text) as unknown);
}

function toWireEnvelope(doc: RxDocument<AssessmentDocType>): AssessmentSyncEnvelope {
  return {
    id: doc.id,
    accountId: doc.accountId,
    encryptedPayload: parseJson(doc.encryptedPayloadJson, EncryptedPayloadSchema),
    vectorClock: parseJson(doc.vectorClockJson, VectorClockSchema),
    updatedAt: doc.updatedAt,
  };
}

async function syncOne(db: AerisDatabase, envelope: AssessmentSyncEnvelope): Promise<void> {
  try {
    const resolved = await pushAssessment(envelope);
    const doc = await db.assessments.findOne(resolved.id).exec();
    await doc?.patch({
      encryptedPayloadJson: JSON.stringify(resolved.encryptedPayload),
      vectorClockJson: JSON.stringify(resolved.vectorClock),
      updatedAt: resolved.updatedAt,
      syncedAt: new Date().toISOString(),
    });
  } catch {
    // Offline-First: Sync-Fehler sind kein Abbruchgrund; syncPending() holt es nach.
  }
}

export async function createAssessment(
  db: AerisDatabase,
  dek: CryptoKey,
  accountId: string,
  deviceId: string,
  answers: AssessmentAnswers,
): Promise<void> {
  const encryptedPayload = await encryptField(dek, JSON.stringify(answers));
  const envelope: AssessmentSyncEnvelope = {
    id: crypto.randomUUID(),
    accountId,
    encryptedPayload,
    vectorClock: incrementVectorClock({}, deviceId),
    updatedAt: new Date().toISOString(),
  };

  await db.assessments.insert({
    id: envelope.id,
    accountId: envelope.accountId,
    encryptedPayloadJson: JSON.stringify(envelope.encryptedPayload),
    vectorClockJson: JSON.stringify(envelope.vectorClock),
    updatedAt: envelope.updatedAt,
    syncedAt: null,
  });

  await syncOne(db, envelope);
}

export async function syncPending(db: AerisDatabase, accountId: string): Promise<void> {
  const pendingDocs = await db.assessments.find({ selector: { accountId, syncedAt: null } }).exec();
  for (const doc of pendingDocs) {
    await syncOne(db, toWireEnvelope(doc));
  }
}

export async function listAssessments(
  db: AerisDatabase,
  dek: CryptoKey,
  accountId: string,
): Promise<AssessmentSummary[]> {
  const docs = await db.assessments.find({ selector: { accountId } }).exec();
  const summaries = await Promise.all(
    docs.map(async (doc) => {
      const encryptedPayload = EncryptedPayloadSchema.parse(JSON.parse(doc.encryptedPayloadJson));
      const plaintext = await decryptField(dek, encryptedPayload);
      const answers = AssessmentAnswersSchema.parse(JSON.parse(plaintext));
      return { id: doc.id, authoredAt: doc.updatedAt, answers };
    }),
  );
  return summaries.sort((a, b) => b.authoredAt.localeCompare(a.authoredAt));
}

function toDecryptedAssessment(
  doc: RxDocument<AssessmentDocType>,
  accountId: string,
  answers: AssessmentAnswers,
): DecryptedAssessment {
  return {
    id: doc.id,
    questionnaireCanonicalUrl: CARE_BURDEN_QUESTIONNAIRE_URL,
    subjectPseudonymId: accountId,
    authoredAt: doc.updatedAt,
    items: ASSESSMENT_QUESTIONS.map((question) => ({
      linkId: question.linkId,
      questionText: question.label,
      value: answers[question.key],
    })),
  };
}

function downloadJsonFile(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/fhir+json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function exportAssessmentAsFhir(
  db: AerisDatabase,
  dek: CryptoKey,
  accountId: string,
  assessmentId: string,
): Promise<void> {
  const doc = await db.assessments.findOne(assessmentId).exec();
  if (!doc) {
    throw new Error('Assessment nicht gefunden.');
  }
  if (doc.accountId !== accountId) {
    throw new Error('Assessment nicht gefunden.');
  }
  const encryptedPayload = EncryptedPayloadSchema.parse(JSON.parse(doc.encryptedPayloadJson));
  const plaintext = await decryptField(dek, encryptedPayload);
  const answers = AssessmentAnswersSchema.parse(JSON.parse(plaintext));

  const resource = toFhirQuestionnaireResponse(toDecryptedAssessment(doc, accountId, answers));
  downloadJsonFile(`aeris-assessment-${doc.id}.json`, resource);
}
