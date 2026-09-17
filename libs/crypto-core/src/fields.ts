import { decryptBytes, encryptBytes } from './aes-gcm';
import type { EncryptedPayload } from './types';

/** Verschlüsselt ein einzelnes sensibles Feld (z. B. Assessment-Antwort, Notiz). */
export async function encryptField(dek: CryptoKey, plaintext: string): Promise<EncryptedPayload> {
  return encryptBytes(dek, new TextEncoder().encode(plaintext));
}

/** Entschlüsselt ein Feld; wirft FieldDecryptionError bei falschem Schlüssel oder Manipulation. */
export async function decryptField(dek: CryptoKey, payload: EncryptedPayload): Promise<string> {
  const bytes = await decryptBytes(dek, payload);
  return new TextDecoder().decode(bytes);
}
