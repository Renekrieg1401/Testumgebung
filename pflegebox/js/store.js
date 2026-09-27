// @ts-check
// Verschlüsselter Speicher (AERIS: aeDetectGateMode/aePinGateStart/persist, hier als injizierbarer Tresor).
// Modi: 'setup' (Erststart), 'unlock' (verschlüsselter Bestand), 'migrate' (Klartext-Altbestand v1).
// Beim Migrieren wird erst verschlüsselt, testweise zurück-entschlüsselt und verglichen — erst danach
// wird die Klartextkopie entfernt (Datenverlust-Schutz).

import { PBKDF2_ITER, ausB64, entschluessele, istUmschlag, leiteSchluesselAb, verschluessele } from './crypto.js';
import { migriereAltbestand, normalisiereDaten, standardDaten } from './model.js';

export const KEY_ENC = 'pflegebox-v2-enc';
export const KEY_ALT = 'bestellschein_aktuell';
export const KEY_ALT_VERSION = 'pflegebox_version';

/**
 * @typedef {import('./model.js').Daten} Daten
 * @typedef {import('./crypto.js').Umschlag} Umschlag
 * @typedef {'setup'|'unlock'|'migrate'} GateModus
 * @typedef {{ getItem(k: string): string|null, setItem(k: string, v: string): void, removeItem(k: string): void }} Speicher
 * @typedef {{ subtle: SubtleCrypto, zufall: (a: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>, jetzt: () => Date }} Umgebung
 * @typedef {{ ok: true } | { ok: false, grund: 'pin'|'defekt'|'speicher'|'krypto'|'altbestand' }} Ergebnis
 */

/** @param {Speicher} speicher @returns {Umschlag|null} */
function leseUmschlag(speicher) {
  try {
    const roh = speicher.getItem(KEY_ENC);
    if (!roh) return null;
    const u = JSON.parse(roh);
    return istUmschlag(u) ? u : null;
  } catch (_) {
    return null;
  }
}

/** @param {Speicher} speicher @returns {unknown} */
function leseAltbestand(speicher) {
  try {
    const roh = speicher.getItem(KEY_ALT);
    return roh ? JSON.parse(roh) : null;
  } catch (_) {
    return null;
  }
}

/** @param {Speicher} speicher @returns {GateModus} */
export function erkenneModus(speicher) {
  if (leseUmschlag(speicher)) return 'unlock';
  const alt = leseAltbestand(speicher);
  return alt && typeof alt === 'object' ? 'migrate' : 'setup';
}

/** @param {string} pin */
export function pinGueltig(pin) { return /^\d{6,8}$/.test(pin); }

/**
 * @param {Speicher} speicher @param {Umgebung} env
 */
export function erzeugeTresor(speicher, env) {
  /** @type {CryptoKey|null} */
  let key = null;
  /** @type {Uint8Array<ArrayBuffer>|null} */
  let salt = null;
  let iter = PBKDF2_ITER;
  /** @type {Daten} */
  let daten = standardDaten(env.jetzt());
  /** @type {Promise<Ergebnis>} */
  let warteschlange = Promise.resolve(/** @type {Ergebnis} */ ({ ok: true }));

  /** @param {string} pin @returns {Promise<Ergebnis>} */
  async function entsperre(pin) {
    const u = leseUmschlag(speicher);
    if (!u) return { ok: false, grund: 'defekt' };
    const s = ausB64(u.salt);
    const k = await leiteSchluesselAb(env.subtle, pin, s, u.iter);
    let roh;
    try {
      roh = await entschluessele(env.subtle, k, u);
    } catch (_) {
      return { ok: false, grund: 'pin' };
    }
    daten = normalisiereDaten(roh, env.jetzt());
    key = k; salt = s; iter = u.iter;
    return { ok: true };
  }

  /**
   * Wiederzugriff nach Sperre: prüft die PIN gegen den gespeicherten Umschlag, ohne den im Speicher
   * gehaltenen (ggf. neueren) Datenstand zu ersetzen. Wartet zuvor ausstehende Schreibvorgänge ab.
   * @param {string} pin @returns {Promise<Ergebnis>}
   */
  async function pruefePin(pin) {
    await warteschlange;
    const u = leseUmschlag(speicher);
    if (!u) return { ok: false, grund: 'defekt' };
    const k = await leiteSchluesselAb(env.subtle, pin, ausB64(u.salt), u.iter);
    try {
      await entschluessele(env.subtle, k, u);
    } catch (_) {
      return { ok: false, grund: 'pin' };
    }
    return { ok: true };
  }

  /** @param {string} pin @param {boolean} migrieren @returns {Promise<Ergebnis>} */
  async function richteEin(pin, migrieren) {
    let quelle = standardDaten(env.jetzt());
    if (migrieren) {
      const alt = migriereAltbestand(leseAltbestand(speicher), env.jetzt());
      if (!alt) return { ok: false, grund: 'altbestand' };
      quelle = alt;
    }
    const s = env.zufall(new Uint8Array(16));
    const k = await leiteSchluesselAb(env.subtle, pin, s, PBKDF2_ITER);
    let u;
    try {
      u = await verschluessele(env.subtle, env.zufall, k, s, PBKDF2_ITER, quelle);
      const probe = await entschluessele(env.subtle, k, u);
      if (JSON.stringify(probe) !== JSON.stringify(quelle)) return { ok: false, grund: 'krypto' };
    } catch (_) {
      return { ok: false, grund: 'krypto' };
    }
    try {
      speicher.setItem(KEY_ENC, JSON.stringify(u));
    } catch (_) {
      return { ok: false, grund: 'speicher' };
    }
    if (migrieren) {
      speicher.removeItem(KEY_ALT);
      speicher.removeItem(KEY_ALT_VERSION);
    }
    daten = quelle; key = k; salt = s; iter = PBKDF2_ITER;
    return { ok: true };
  }

  /** Serialisiert nebenläufige Schreibvorgänge (AERIS: aePersistQueue). @returns {Promise<Ergebnis>} */
  function speichere() {
    warteschlange = warteschlange.then(async () => {
      if (!key || !salt) return /** @type {Ergebnis} */ ({ ok: false, grund: 'krypto' });
      let u;
      try {
        u = await verschluessele(env.subtle, env.zufall, key, salt, iter, daten);
      } catch (_) {
        return /** @type {Ergebnis} */ ({ ok: false, grund: 'krypto' });
      }
      try {
        speicher.setItem(KEY_ENC, JSON.stringify(u));
      } catch (_) {
        return /** @type {Ergebnis} */ ({ ok: false, grund: 'speicher' });
      }
      return /** @type {Ergebnis} */ ({ ok: true });
    });
    return warteschlange;
  }

  /** @returns {string|null} Aktueller verschlüsselter Umschlag als Sicherungsdatei-Inhalt */
  function sicherung() {
    const u = leseUmschlag(speicher);
    return u ? JSON.stringify({ app: 'PflegeBox', erstellt: env.jetzt().toISOString(), umschlag: u }) : null;
  }

  /**
   * Stellt eine Sicherung wieder her; die PIN der Sicherung wird danach zur aktiven PIN.
   * @param {string} inhalt @param {string} pin @returns {Promise<Ergebnis>}
   */
  async function stelleWiederHer(inhalt, pin) {
    let u;
    try {
      const o = JSON.parse(inhalt);
      u = o && typeof o === 'object' ? o.umschlag : null;
    } catch (_) {
      return { ok: false, grund: 'defekt' };
    }
    if (!istUmschlag(u)) return { ok: false, grund: 'defekt' };
    const s = ausB64(u.salt);
    const k = await leiteSchluesselAb(env.subtle, pin, s, u.iter);
    let roh;
    try {
      roh = await entschluessele(env.subtle, k, u);
    } catch (_) {
      return { ok: false, grund: 'pin' };
    }
    await warteschlange;
    daten = normalisiereDaten(roh, env.jetzt());
    key = k; salt = s; iter = u.iter;
    return speichere();
  }

  function loescheAlles() {
    speicher.removeItem(KEY_ENC);
    speicher.removeItem(KEY_ALT);
    speicher.removeItem(KEY_ALT_VERSION);
    key = null; salt = null;
    daten = standardDaten(env.jetzt());
  }

  return {
    entsperre, pruefePin, richteEin, speichere, sicherung, stelleWiederHer, loescheAlles,
    /** @returns {Daten} */ get daten() { return daten; },
    /** @returns {boolean} */ get entsperrt() { return key !== null; }
  };
}

/** @typedef {ReturnType<typeof erzeugeTresor>} Tresor */
