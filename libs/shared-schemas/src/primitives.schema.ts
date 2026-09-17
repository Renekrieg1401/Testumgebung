import { z } from 'zod';

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export const Base64Schema = z.string().min(1).regex(BASE64_PATTERN, 'Muss Base64-kodiert sein.');

export const EncryptedPayloadSchema = z.object({
  algorithm: z.literal('AES-256-GCM'),
  iv: Base64Schema,
  ciphertext: Base64Schema,
});
export type EncryptedPayload = z.infer<typeof EncryptedPayloadSchema>;

export const Argon2idParamsSchema = z.object({
  algorithm: z.literal('argon2id'),
  iterations: z.number().int().positive(),
  memoryKiB: z.number().int().positive(),
  parallelism: z.number().int().positive(),
});
export type Argon2idParams = z.infer<typeof Argon2idParamsSchema>;

export const VaultEnvelopeSchema = z.object({
  version: z.literal(1),
  salt: Base64Schema,
  kdf: Argon2idParamsSchema,
  wrappedDek: EncryptedPayloadSchema,
});
export type VaultEnvelope = z.infer<typeof VaultEnvelopeSchema>;
