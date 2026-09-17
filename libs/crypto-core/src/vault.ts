import { deriveKeyMaterial } from './argon2';
import { decryptBytes, encryptBytes, exportRawKey, generateAesGcmKey, importAesGcmKey } from './aes-gcm';
import { base64ToBytes, bytesToBase64 } from './encoding';
import { VaultUnlockError } from './errors';
import { DEFAULT_ARGON2ID_PARAMS } from './types';
import type { Argon2idParams, VaultEnvelope } from './types';

const SALT_LENGTH_BYTES = 16;

export interface CreatedVault {
  readonly envelope: VaultEnvelope;
  readonly dek: CryptoKey;
}

async function deriveKek(
  passphrase: string,
  salt: Uint8Array,
  params: Argon2idParams,
): Promise<CryptoKey> {
  const keyMaterial = await deriveKeyMaterial(passphrase, salt, params);
  return importAesGcmKey(keyMaterial, false);
}

/**
 * Erzeugt einen neuen Vault: zufälliger DEK, gewrappt durch einen aus der
 * Passphrase abgeleiteten KEK. Nur das Envelope (Salt, KDF-Parameter,
 * gewrappter DEK) darf den Client verlassen.
 */
export async function createVault(
  passphrase: string,
  params: Argon2idParams = DEFAULT_ARGON2ID_PARAMS,
): Promise<CreatedVault> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const kek = await deriveKek(passphrase, salt, params);
  const dek = await generateAesGcmKey();
  const rawDek = await exportRawKey(dek);
  const wrappedDek = await encryptBytes(kek, rawDek);
  return {
    envelope: { version: 1, salt: bytesToBase64(salt), kdf: params, wrappedDek },
    dek,
  };
}

/**
 * Entsperrt einen bestehenden Vault. Der DEK bleibt extrahierbar, damit
 * eine spätere Passphrase-Rotation ohne erneute Serverkommunikation
 * möglich ist — er verlässt den Client dennoch nie unverschlüsselt.
 */
export async function unlockVault(passphrase: string, envelope: VaultEnvelope): Promise<CryptoKey> {
  const salt = base64ToBytes(envelope.salt);
  const kek = await deriveKek(passphrase, salt, envelope.kdf);
  try {
    const rawDek = await decryptBytes(kek, envelope.wrappedDek);
    return await importAesGcmKey(rawDek, true);
  } catch (cause) {
    throw new VaultUnlockError('Passphrase falsch oder Vault-Daten beschädigt.', { cause });
  }
}

/**
 * Rotiert die Passphrase, ohne den DEK zu ändern — bestehende
 * verschlüsselte Felder bleiben unverändert gültig.
 */
export async function rotatePassphrase(
  oldPassphrase: string,
  newPassphrase: string,
  envelope: VaultEnvelope,
): Promise<VaultEnvelope> {
  const dek = await unlockVault(oldPassphrase, envelope);
  const rawDek = await exportRawKey(dek);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const kek = await deriveKek(newPassphrase, salt, envelope.kdf);
  const wrappedDek = await encryptBytes(kek, rawDek);
  return { version: 1, salt: bytesToBase64(salt), kdf: envelope.kdf, wrappedDek };
}
