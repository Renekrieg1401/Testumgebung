export type { Argon2idParams, EncryptedPayload, VaultEnvelope } from './types';
export { DEFAULT_ARGON2ID_PARAMS } from './types';
export { VaultUnlockError, FieldDecryptionError } from './errors';
export { createVault, unlockVault, rotatePassphrase } from './vault';
export type { CreatedVault } from './vault';
export { encryptField, decryptField } from './fields';
export { bytesToBase64, base64ToBytes } from './encoding';
