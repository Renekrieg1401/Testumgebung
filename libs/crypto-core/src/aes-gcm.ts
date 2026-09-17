import { base64ToBytes, bytesToBase64 } from './encoding';
import { FieldDecryptionError } from './errors';
import type { EncryptedPayload } from './types';

const AES_GCM_IV_LENGTH_BYTES = 12;
const AES_GCM_KEY_LENGTH_BITS = 256;

export async function importAesGcmKey(
  rawKey: Uint8Array<ArrayBuffer>,
  extractable: boolean,
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM', length: AES_GCM_KEY_LENGTH_BITS },
    extractable,
    ['encrypt', 'decrypt'],
  );
}

export async function generateAesGcmKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: AES_GCM_KEY_LENGTH_BITS }, true, [
    'encrypt',
    'decrypt',
  ]);
}

export async function exportRawKey(key: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(raw);
}

export async function encryptBytes(
  key: CryptoKey,
  plaintext: Uint8Array<ArrayBuffer>,
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH_BYTES));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    algorithm: 'AES-256-GCM',
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptBytes(
  key: CryptoKey,
  payload: EncryptedPayload,
): Promise<Uint8Array<ArrayBuffer>> {
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.ciphertext);
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new Uint8Array(plaintext);
  } catch (cause) {
    throw new FieldDecryptionError(
      'Entschlüsselung fehlgeschlagen: falscher Schlüssel oder manipulierte Daten.',
      { cause },
    );
  }
}
