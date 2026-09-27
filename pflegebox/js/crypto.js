// @ts-check
// Clientseitige Verschlüsselung (AERIS-Muster „PIN-Gate + AES-GCM“): PBKDF2-SHA-256 → AES-256-GCM.
// Salt/IV sind nicht geheim und liegen im Umschlag neben dem Ciphertext. Die Iterationszahl wird mit
// abgelegt, damit sie künftig erhöht werden kann, ohne Altbestände unlesbar zu machen.

export const PBKDF2_ITER = 600000;
const AAD = new TextEncoder().encode('pflegebox:v2');

/**
 * @typedef {{ v: 2, kdf: 'PBKDF2-SHA256', iter: number, salt: string, iv: string, ct: string }} Umschlag
 */

/** @param {Uint8Array<ArrayBuffer>} bytes @returns {string} */
export function zuB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return btoa(bin);
}

/** @param {string} b64 @returns {Uint8Array<ArrayBuffer>} */
export function ausB64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** @param {unknown} v @returns {v is Umschlag} */
export function istUmschlag(v) {
  if (typeof v !== 'object' || v === null) return false;
  const o = /** @type {Record<string, unknown>} */ (v);
  return o.v === 2 && o.kdf === 'PBKDF2-SHA256' && typeof o.iter === 'number' && o.iter >= 100000 && o.iter <= 5000000 &&
    typeof o.salt === 'string' && typeof o.iv === 'string' && typeof o.ct === 'string';
}

/**
 * @param {SubtleCrypto} subtle @param {string} pin @param {Uint8Array<ArrayBuffer>} salt @param {number} iter
 * @returns {Promise<CryptoKey>}
 */
export async function leiteSchluesselAb(subtle, pin, salt, iter) {
  const material = await subtle.importKey('raw', new TextEncoder().encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

/**
 * @param {SubtleCrypto} subtle @param {(a: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>} zufall
 * @param {CryptoKey} key @param {Uint8Array<ArrayBuffer>} salt @param {number} iter @param {unknown} daten
 * @returns {Promise<Umschlag>}
 */
export async function verschluessele(subtle, zufall, key, salt, iter, daten) {
  const iv = zufall(new Uint8Array(12));
  const klar = new TextEncoder().encode(JSON.stringify(daten));
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, klar));
  return { v: 2, kdf: 'PBKDF2-SHA256', iter, salt: zuB64(salt), iv: zuB64(iv), ct: zuB64(ct) };
}

/** @param {SubtleCrypto} subtle @param {CryptoKey} key @param {Umschlag} u @returns {Promise<unknown>} */
export async function entschluessele(subtle, key, u) {
  const klar = await subtle.decrypt({ name: 'AES-GCM', iv: ausB64(u.iv), additionalData: AAD }, key, ausB64(u.ct));
  return JSON.parse(new TextDecoder().decode(klar));
}
