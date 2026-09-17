/**
 * Argon2id-Parameter nach OWASP-Empfehlung (m≥19 MiB, hier 64 MiB für höhere
 * Sicherheitsmarge bei clientseitiger Ausführung auf modernen Endgeräten).
 */
export interface Argon2idParams {
  readonly algorithm: 'argon2id';
  readonly iterations: number;
  readonly memoryKiB: number;
  readonly parallelism: number;
}

export const DEFAULT_ARGON2ID_PARAMS: Argon2idParams = {
  algorithm: 'argon2id',
  iterations: 3,
  memoryKiB: 65536,
  parallelism: 1,
};

export interface EncryptedPayload {
  readonly algorithm: 'AES-256-GCM';
  readonly iv: string;
  readonly ciphertext: string;
}

/**
 * Persistierbare, ausschließlich opake Struktur. Der Server sieht niemals
 * die Passphrase oder den unverschlüsselten Data-Encryption-Key (DEK).
 */
export interface VaultEnvelope {
  readonly version: 1;
  readonly salt: string;
  readonly kdf: Argon2idParams;
  readonly wrappedDek: EncryptedPayload;
}
