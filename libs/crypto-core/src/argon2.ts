import { argon2idAsync } from '@noble/hashes/argon2.js';
import type { Argon2idParams } from './types';

const DERIVED_KEY_LENGTH_BYTES = 32;

/**
 * Leitet 32 Byte Schlüsselmaterial aus Passphrase + Salt ab. Läuft
 * isomorph in Browser und Node (reines JS, kein Native-Binding) und
 * asynchron nicht-blockierend im UI-Thread.
 */
export async function deriveKeyMaterial(
  passphrase: string,
  salt: Uint8Array,
  params: Argon2idParams,
): Promise<Uint8Array<ArrayBuffer>> {
  const passphraseBytes = new TextEncoder().encode(passphrase.normalize('NFKC'));
  const derived = await argon2idAsync(passphraseBytes, salt, {
    t: params.iterations,
    m: params.memoryKiB,
    p: params.parallelism,
    dkLen: DERIVED_KEY_LENGTH_BYTES,
  });
  // Normalisiert auf ArrayBuffer-Backing, da @noble/hashes generisch über
  // ArrayBufferLike zurückgibt und WebCrypto einen konkreten ArrayBuffer erwartet.
  return new Uint8Array(derived);
}
