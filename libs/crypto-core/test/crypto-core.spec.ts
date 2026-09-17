import { describe, expect, it } from 'vitest';
import {
  createVault,
  decryptField,
  encryptField,
  FieldDecryptionError,
  unlockVault,
  VaultUnlockError,
  type Argon2idParams,
} from '../src/index';

// Minimale KDF-Kosten ausschließlich für schnelle Testläufe — niemals in Produktion verwenden.
const FAST_TEST_PARAMS: Argon2idParams = {
  algorithm: 'argon2id',
  iterations: 1,
  memoryKiB: 1024,
  parallelism: 1,
};

describe('Zero-Knowledge-Vault', () => {
  it('verschlüsselt und entschlüsselt ein Feld im Rundtrip', async () => {
    const { envelope, dek } = await createVault('correct horse battery staple', FAST_TEST_PARAMS);
    const payload = await encryptField(dek, 'PHQ-9 Score: 14');

    const decrypted = await decryptField(dek, payload);

    expect(decrypted).toBe('PHQ-9 Score: 14');
    expect(envelope.wrappedDek.ciphertext).not.toContain('PHQ-9');
  });

  it('entsperrt den Vault erneut mit der korrekten Passphrase', async () => {
    const { envelope, dek } = await createVault('correct horse battery staple', FAST_TEST_PARAMS);
    const payload = await encryptField(dek, 'geheime Notiz');

    const reopenedDek = await unlockVault('correct horse battery staple', envelope);
    const decrypted = await decryptField(reopenedDek, payload);

    expect(decrypted).toBe('geheime Notiz');
  });

  it('lehnt eine falsche Passphrase ab', async () => {
    const { envelope } = await createVault('correct horse battery staple', FAST_TEST_PARAMS);

    await expect(unlockVault('falsche-passphrase', envelope)).rejects.toBeInstanceOf(
      VaultUnlockError,
    );
  });

  it('erkennt einen manipulierten Ciphertext', async () => {
    const { dek } = await createVault('correct horse battery staple', FAST_TEST_PARAMS);
    const payload = await encryptField(dek, 'unveränderte Nachricht');
    const tampered = { ...payload, ciphertext: `${payload.ciphertext.slice(0, -4)}AAAA` };

    await expect(decryptField(dek, tampered)).rejects.toBeInstanceOf(FieldDecryptionError);
  });
});
