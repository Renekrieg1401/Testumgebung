// @ts-check
// Cloud-Spiegel für den Betrieb als claude.ai-Artifact: Dort ist der Browser-Speicher nicht zuverlässig
// (kann beim Schließen der App verworfen werden). Jede Änderung wird daher zusätzlich in den privaten
// Bereich des Nutzers (data/users/<id>/) der Artifact-Datenbank geschrieben — ein Dokument je Monat plus
// eines für die Einstellungen. Abgleich beim Start: je Monat gewinnt der jüngere Stand („geaendert“).
// Außerhalb von claude.ai (normales Hosting) ist der Spiegel inaktiv; es gilt nur localStorage.

import { normEinstellungen, normMonat, istYm } from './model.js';

const EINSTELLUNGEN = 'einstellungen';
const PRAEFIX = 'monat-';
const SCHREIB_PAUSE_MS = 800;

/**
 * @typedef {import('./model.js').Daten} Daten
 * @typedef {{ get(): Promise<{ exists: boolean, data(): Record<string, unknown>|undefined }>,
 *   set(d: Record<string, unknown>): Promise<void>, delete(): Promise<void> }} DokRef
 * @typedef {{ id: string, data(): Record<string, unknown>|undefined }} DokSnap
 * @typedef {{ doc(id: string): DokRef, get(): Promise<{ docs: DokSnap[] }> }} Sammlung
 * @typedef {{ collection(path: string): Sammlung }} Db
 * @typedef {{ id(): Promise<string|null> }} Nutzer
 * @typedef {{ use(name: string): Promise<unknown> }} ClaudeLaufzeit
 */

/** @param {unknown} ns @param {string} methode @returns {boolean} */
function hat(ns, methode) {
  return !!ns && typeof /** @type {Record<string, unknown>} */ (ns)[methode] === 'function';
}

/** @returns {Promise<Sammlung|null>} */
async function verbinde() {
  const laufzeit = /** @type {{ claude?: ClaudeLaufzeit }} */ (/** @type {unknown} */ (window)).claude;
  if (!laufzeit || typeof laufzeit.use !== 'function') return null;
  const [nutzer, db] = await Promise.all([laufzeit.use('user'), laufzeit.use('db')]);
  if (!hat(nutzer, 'id') || !hat(db, 'collection')) return null;
  const id = await /** @type {Nutzer} */ (nutzer).id();
  return id ? /** @type {Db} */ (db).collection('data/users/' + id) : null;
}

/**
 * Führt entfernte Dokumente in den lokalen Bestand zusammen (jüngerer Stand gewinnt).
 * @param {Daten} d @param {DokSnap[]} docs @param {Date} jetzt
 * @returns {{ geaendert: boolean, lokalNeuer: string[] }}
 */
export function fuehreZusammen(d, docs, jetzt) {
  let geaendert = false;
  /** @type {Set<string>} */
  const entfernt = new Set();
  /** @type {string[]} */
  const lokalNeuer = [];
  docs.forEach((doc) => {
    const body = doc.data() || {};
    const zeit = typeof body.zeit === 'string' ? body.zeit : '';
    let inhalt;
    try { inhalt = JSON.parse(typeof body.json === 'string' ? body.json : 'null'); } catch (_) { return; }
    if (doc.id === EINSTELLUNGEN) {
      entfernt.add(EINSTELLUNGEN);
      if (zeit > d.einstellungenGeaendert) { d.einstellungen = normEinstellungen(inhalt); d.einstellungenGeaendert = zeit; geaendert = true; }
      else if (d.einstellungenGeaendert > zeit) lokalNeuer.push(EINSTELLUNGEN);
      return;
    }
    const ym = doc.id.slice(PRAEFIX.length);
    if (!doc.id.startsWith(PRAEFIX) || !istYm(ym)) return;
    entfernt.add(ym);
    const lokal = d.monate[ym];
    if (!lokal || zeit > lokal.geaendert) { d.monate[ym] = normMonat(inhalt, ym, jetzt.toISOString()); geaendert = true; }
    else if (lokal.geaendert > zeit) lokalNeuer.push(ym);
  });
  Object.keys(d.monate).filter((ym) => !entfernt.has(ym)).forEach((ym) => lokalNeuer.push(ym));
  if (d.einstellungenGeaendert && !entfernt.has(EINSTELLUNGEN)) lokalNeuer.push(EINSTELLUNGEN);
  return { geaendert, lokalNeuer };
}

/** @param {() => Daten} daten @param {() => Date} jetzt */
export function erzeugeSpiegel(daten, jetzt) {
  /** @type {Sammlung|null} */
  let sammlung = null;
  /** @type {Set<string>} */
  const offen = new Set();
  /** @type {number|undefined} */
  let timer;
  /** @type {Promise<void>} */
  let kette = Promise.resolve();

  /** @param {string} schluessel */
  function schreibe(schluessel) {
    const s = sammlung;
    if (!s) return Promise.resolve();
    const d = daten();
    if (schluessel === EINSTELLUNGEN) {
      return s.doc(EINSTELLUNGEN).set({ json: JSON.stringify(d.einstellungen), zeit: d.einstellungenGeaendert || jetzt().toISOString() });
    }
    const m = d.monate[schluessel];
    return m ? s.doc(PRAEFIX + schluessel).set({ json: JSON.stringify(m), zeit: m.geaendert }) : s.doc(PRAEFIX + schluessel).delete();
  }

  /** Schreibt alle offenen Dokumente nacheinander (ein Schreibvorgang je Dokument zur Zeit). */
  function flush() {
    window.clearTimeout(timer);
    timer = undefined;
    if (!sammlung || offen.size === 0) return kette;
    const liste = Array.from(offen);
    offen.clear();
    kette = kette.then(async () => {
      for (const k of liste) {
        try { await schreibe(k); } catch (_) { offen.add(k); }
      }
    });
    return kette;
  }

  return {
    /**
     * Verbindet (nur im Artifact) und gleicht ab. Liefert true, wenn entfernte Daten übernommen wurden.
     * @returns {Promise<boolean>}
     */
    async start() {
      try { sammlung = await verbinde(); } catch (_) { sammlung = null; }
      if (!sammlung) return false;
      let docs;
      try { docs = (await sammlung.get()).docs; } catch (_) { return false; }
      const erg = fuehreZusammen(daten(), docs, jetzt());
      erg.lokalNeuer.forEach((k) => offen.add(k));
      flush();
      return erg.geaendert;
    },
    /** @param {string} schluessel Monat (YYYY-MM) oder 'einstellungen' */
    markiere(schluessel) {
      offen.add(schluessel);
      window.clearTimeout(timer);
      timer = window.setTimeout(flush, SCHREIB_PAUSE_MS);
    },
    flush,
    /** @returns {boolean} */ get aktiv() { return sammlung !== null; }
  };
}
