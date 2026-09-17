import type { RxJsonSchema } from 'rxdb';

/**
 * Persistiert exakt die opaken Wire-Strukturen aus @aeris/shared-schemas
 * als JSON-Strings (statt verschachtelter RxDB-Teilschemata) — der Server
 * und der lokale Store teilen sich damit ein einziges Datenmodell.
 */
export interface VaultDocType {
  readonly accountId: string;
  readonly envelopeJson: string;
}

export const vaultSchema: RxJsonSchema<VaultDocType> = {
  version: 0,
  primaryKey: 'accountId',
  type: 'object',
  properties: {
    accountId: { type: 'string', maxLength: 100 },
    envelopeJson: { type: 'string' },
  },
  required: ['accountId', 'envelopeJson'],
};

export interface AssessmentDocType {
  readonly id: string;
  readonly accountId: string;
  readonly encryptedPayloadJson: string;
  readonly vectorClockJson: string;
  readonly updatedAt: string;
  readonly syncedAt: string | null;
}

export const assessmentSchema: RxJsonSchema<AssessmentDocType> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    accountId: { type: 'string', maxLength: 100 },
    encryptedPayloadJson: { type: 'string' },
    vectorClockJson: { type: 'string' },
    updatedAt: { type: 'string', maxLength: 40 },
    syncedAt: { type: ['string', 'null'] },
  },
  required: ['id', 'accountId', 'encryptedPayloadJson', 'vectorClockJson', 'updatedAt', 'syncedAt'],
  indexes: ['accountId', 'updatedAt'],
};
