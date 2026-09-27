// @ts-check
// Lokaler Speicher (localStorage, schema-versioniert, AERIS-Muster „aeApplyMigrations“): jeder geladene
// Bestand läuft durch normalisiereDaten(). Der Klartext-Altbestand des Bestellscheins v1
// wird beim ersten Start automatisch übernommen und erst nach erfolgreichem Schreiben entfernt.

import { migriereAltbestand, normalisiereDaten, standardDaten } from './model.js';

export const KEY = 'pflegebox-v2';
export const KEY_ALT = 'bestellschein_aktuell';
export const KEY_ALT_VERSION = 'pflegebox_version';

/**
 * @typedef {import('./model.js').Daten} Daten
 * @typedef {{ getItem(k: string): string|null, setItem(k: string, v: string): void, removeItem(k: string): void }} Speicher
 * @typedef {{ ok: true } | { ok: false, grund: 'speicher' }} Ergebnis
 */

/** @param {Speicher} speicher @param {string} key @returns {unknown} */
function leseJson(speicher, key) {
  try {
    const roh = speicher.getItem(key);
    return roh ? JSON.parse(roh) : null;
  } catch (_) {
    return null;
  }
}

/** @param {Speicher} speicher @param {() => Date} jetzt */
export function erzeugeSpeicher(speicher, jetzt) {
  /** @type {Daten} */
  let daten = standardDaten(jetzt());

  /** @returns {Ergebnis} */
  function speichere() {
    try {
      speicher.setItem(KEY, JSON.stringify(daten));
      return { ok: true };
    } catch (_) {
      return { ok: false, grund: 'speicher' };
    }
  }

  /** @returns {'neu'|'geladen'|'migriert'} */
  function lade() {
    const aktuell = leseJson(speicher, KEY);
    if (aktuell) { daten = normalisiereDaten(aktuell, jetzt()); return 'geladen'; }
    const alt = migriereAltbestand(leseJson(speicher, KEY_ALT), jetzt());
    if (!alt) return 'neu';
    daten = alt;
    if (speichere().ok) {
      speicher.removeItem(KEY_ALT);
      speicher.removeItem(KEY_ALT_VERSION);
    }
    return 'migriert';
  }

  return {
    lade, speichere,
    /** @returns {Daten} */ get daten() { return daten; }
  };
}

/** @typedef {ReturnType<typeof erzeugeSpeicher>} DatenSpeicher */
