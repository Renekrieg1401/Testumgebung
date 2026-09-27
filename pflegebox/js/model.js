// @ts-check
// Fachliches Datenmodell der PflegeBox (rein, ohne DOM/I/O).
// Übernommene AERIS-Logik: schema-versionierter Datenbestand mit zentralem Migrations-Sicherheitsnetz
// je Monat.

export const SCHEMA = 2;
export const MAX_ZEILEN = 60;
export const MAX_PACKUNGEN = 5;

export const MONATSNAMEN = Object.freeze([
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
]);

/**
 * @typedef {'hs'|'hm'|'hl'|'wh'|'ul'|'dh'|'df'|'wph'|'wpf'} ArtikelKey
 * @typedef {{ key: ArtikelKey, label: string, kurz: string, typ: 'menge'|'check' }} Artikel
 */

/** Bestellbare Pflegehilfsmittel (Inkontinenzmaterial separat als Freitext). */
export const ARTIKEL = /** @type {ReadonlyArray<Artikel>} */ (Object.freeze([
  { key: 'hs', label: 'Einmalhandschuhe Gr. S', kurz: 'Handsch. S', typ: 'menge' },
  { key: 'hm', label: 'Einmalhandschuhe Gr. M', kurz: 'Handsch. M', typ: 'menge' },
  { key: 'hl', label: 'Einmalhandschuhe Gr. L', kurz: 'Handsch. L', typ: 'menge' },
  { key: 'wh', label: 'Einmal-Waschhandschuhe', kurz: 'Waschh.', typ: 'check' },
  { key: 'ul', label: 'Einmal-Krankenunterlagen', kurz: 'Unterl.', typ: 'check' },
  { key: 'dh', label: 'Desinfektionsmittel Hände', kurz: 'Desinf. H', typ: 'check' },
  { key: 'df', label: 'Desinfektionsmittel Fläche', kurz: 'Desinf. F', typ: 'check' },
  { key: 'wph', label: 'Desinfektions-Wipes Hände', kurz: 'Wipes H', typ: 'check' },
  { key: 'wpf', label: 'Desinfektions-Wipes Fläche', kurz: 'Wipes F', typ: 'check' }
]));

/**
 * @typedef {{
 *   id: string, name: string,
 *   hs: number, hm: number, hl: number,
 *   wh: boolean, ul: boolean, dh: boolean, df: boolean, wph: boolean, wpf: boolean,
 *   inko: string
 * }} Zeile
 * @typedef {{
 *   zeilen: Zeile[], geaendert: string, gesendet: Gesendet|null
 * }} Monat
 * @typedef {'PDF'|'JPG'} Format
 * @typedef {{ zeilen: Zeile[], zeit: string, format: Format }} Gesendet
 * @typedef {{ name: string, strasse: string, ort: string, telefon: string }} Anschrift
 * @typedef {{ name: string, email: string, kundennr: string }} Lieferant
 * @typedef {{ absender: Anschrift, lieferant: Lieferant }} Einstellungen
 * @typedef {{
 *   schema: number, einstellungen: Einstellungen, einstellungenGeaendert: string,
 *   monate: Record<string, Monat>, aktuellerMonat: string
 * }} Daten
 */

/** @param {number} n */
export function pad2(n) { return n < 10 ? '0' + n : String(n); }

/** @param {Date} d @returns {string} */
export function ymAus(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }

/** @param {string} ym @param {number} delta @returns {string} */
export function ymVerschieben(ym, delta) {
  const j = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7)) - 1 + delta;
  const jahr = j + Math.floor(m / 12);
  const monat = ((m % 12) + 12) % 12;
  return jahr + '-' + pad2(monat + 1);
}

/** @param {string} ym @returns {string} */
export function ymText(ym) {
  const idx = Number(ym.slice(5, 7)) - 1;
  return (MONATSNAMEN[idx] || '') + ' ' + ym.slice(0, 4);
}

/** @param {unknown} v @returns {v is string} */
export function istYm(v) { return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v); }

/** @returns {Record<ArtikelKey, number>} */
function nullmengen() {
  return { hs: 0, hm: 0, hl: 0, wh: 0, ul: 0, dh: 0, df: 0, wph: 0, wpf: 0 };
}

/** @param {Date} jetzt @returns {Daten} */
export function standardDaten(jetzt) {
  return {
    schema: SCHEMA,
    einstellungen: {
      absender: { name: '', strasse: '', ort: '', telefon: '' },
      lieferant: { name: '', email: '', kundennr: '' }
    },
    einstellungenGeaendert: '',
    monate: {},
    aktuellerMonat: ymAus(jetzt)
  };
}

/** @param {() => number} zufall @returns {string} */
export function neueId(zufall) {
  return 'z' + Math.floor(zufall() * 0x7fffffff).toString(36) + Math.floor(zufall() * 0x7fffffff).toString(36);
}

/** @param {string} id @returns {Zeile} */
export function leereZeile(id) {
  return { id, name: '', hs: 0, hm: 0, hl: 0, wh: false, ul: false, dh: false, df: false, wph: false, wpf: false, inko: '' };
}

/** @param {Zeile} z @returns {boolean} */
export function istLeer(z) {
  return z.name.trim() === '' && z.inko.trim() === '' &&
    ARTIKEL.every((a) => (a.typ === 'menge' ? z[a.key] === 0 : z[a.key] === false));
}

/** @param {string} jetztIso @returns {Monat} */
export function neuerMonat(jetztIso) {
  return { zeilen: [], geaendert: jetztIso, gesendet: null };
}

// ---------- Validierung/Normalisierung an der Vertrauensgrenze (entschlüsselter/importierter Bestand) ----------

/** @param {unknown} v @returns {v is Record<string, unknown>} */
function istObjekt(v) { return typeof v === 'object' && v !== null && !Array.isArray(v); }
/** @param {unknown} v @param {number} max */
function text(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
/** @param {unknown} v @param {number} min @param {number} max */
function ganzzahl(v, min, max) {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** @param {unknown} v @param {string} ersatzId @returns {Zeile} */
function normZeile(v, ersatzId) {
  const o = istObjekt(v) ? v : {};
  const id = typeof o.id === 'string' && /^[a-z0-9]{1,32}$/.test(o.id) ? o.id : ersatzId;
  return {
    id, name: text(o.name, 80),
    hs: ganzzahl(o.hs, 0, MAX_PACKUNGEN), hm: ganzzahl(o.hm, 0, MAX_PACKUNGEN), hl: ganzzahl(o.hl, 0, MAX_PACKUNGEN),
    wh: o.wh === true, ul: o.ul === true, dh: o.dh === true, df: o.df === true, wph: o.wph === true, wpf: o.wpf === true,
    inko: text(o.inko, 80)
  };
}

/** @param {unknown} v @param {string} praefix @returns {Zeile[]} */
function normZeilen(v, praefix) {
  const roh = Array.isArray(v) ? v.slice(0, MAX_ZEILEN) : [];
  /** @type {Set<string>} */
  const ids = new Set();
  return roh.map((z, i) => {
    const zeile = normZeile(z, praefix + i);
    if (ids.has(zeile.id)) zeile.id = praefix + i;
    ids.add(zeile.id);
    return zeile;
  }).filter((z) => !istLeer(z));
}

/** @param {unknown} v @param {string} ym @returns {Gesendet|null} */
function normGesendet(v, ym) {
  if (!istObjekt(v)) return null;
  const zeilen = normZeilen(v.zeilen, 'g' + ym.replace('-', '') + 'r');
  if (zeilen.length === 0) return null;
  return { zeilen, zeit: text(v.zeit, 40), format: v.format === 'JPG' ? 'JPG' : 'PDF' };
}

/** @param {unknown} v @param {string} ym @param {string} jetztIso @returns {Monat} */
export function normMonat(v, ym, jetztIso) {
  const o = istObjekt(v) ? v : {};
  const zeilen = normZeilen(o.zeilen, 'm' + ym.replace('-', '') + 'r');
  return { zeilen, geaendert: text(o.geaendert, 40) || jetztIso, gesendet: normGesendet(o.gesendet, ym) };
}

/** @param {unknown} v @returns {Einstellungen} */
export function normEinstellungen(v) {
  const o = istObjekt(v) ? v : {};
  const abs = istObjekt(o.absender) ? o.absender : {};
  const lief = istObjekt(o.lieferant) ? o.lieferant : {};
  return {
    absender: { name: text(abs.name, 120), strasse: text(abs.strasse, 120), ort: text(abs.ort, 120), telefon: text(abs.telefon, 60) },
    lieferant: { name: text(lief.name, 120), email: text(lief.email, 120), kundennr: text(lief.kundennr, 60) }
  };
}

/**
 * Migrations-Sicherheitsnetz: jeder Bestand (entschlüsselt, importiert) läuft hier durch.
 * @param {unknown} roh @param {Date} jetzt @returns {Daten}
 */
export function normalisiereDaten(roh, jetzt) {
  const o = istObjekt(roh) ? roh : {};
  const jetztIso = jetzt.toISOString();
  /** @type {Record<string, Monat>} */
  const monate = {};
  if (istObjekt(o.monate)) {
    Object.keys(o.monate).filter(istYm).sort().forEach((ym) => {
      monate[ym] = normMonat(/** @type {Record<string, unknown>} */ (o.monate)[ym], ym, jetztIso);
    });
  }
  return {
    schema: SCHEMA,
    einstellungen: normEinstellungen(o.einstellungen),
    einstellungenGeaendert: text(o.einstellungenGeaendert, 40),
    monate,
    aktuellerMonat: istYm(o.aktuellerMonat) ? o.aktuellerMonat : ymAus(jetzt)
  };
}

/**
 * Übernahme des unverschlüsselten Altbestands (Bestellschein v1, Schlüssel "bestellschein_aktuell":
 * flaches Objekt {monat:'Oktober', 'name-0':..., 's-0':'2', 'wh-0':true, ...}, 16 Zeilen).
 * Jahr: Monat liegt höchstens 6 Monate in der Zukunft, sonst Vorjahr.
 * @param {unknown} roh @param {Date} jetzt @returns {Daten|null}
 */
export function migriereAltbestand(roh, jetzt) {
  if (!istObjekt(roh)) return null;
  const daten = standardDaten(jetzt);
  const idx = MONATSNAMEN.indexOf(typeof roh.monat === 'string' ? roh.monat : '');
  let ym = ymAus(jetzt);
  if (idx >= 0) {
    const diff = idx - jetzt.getMonth();
    ym = (diff > 6 ? jetzt.getFullYear() - 1 : jetzt.getFullYear()) + '-' + pad2(idx + 1);
  }
  const monat = neuerMonat(jetzt.toISOString());
  for (let i = 0; i < 16; i++) {
    const z = normZeile({
      id: 'alt' + i, name: roh['name-' + i], hs: roh['s-' + i], hm: roh['m-' + i], hl: roh['l-' + i],
      wh: roh['wh-' + i], ul: roh['ul-' + i], dh: roh['dh-' + i], df: roh['df-' + i],
      wph: roh['wph-' + i], wpf: roh['wpf-' + i], inko: roh['inko-' + i]
    }, 'alt' + i);
    if (!istLeer(z)) monat.zeilen.push(z);
  }
  daten.monate[ym] = monat;
  daten.aktuellerMonat = ym;
  return daten;
}

// ---------- Fachlogik ----------

/** @param {Daten} d @param {string} ym @param {string} jetztIso @returns {Monat} */
export function holeMonat(d, ym, jetztIso) {
  const vorhanden = d.monate[ym];
  if (vorhanden) return vorhanden;
  const m = neuerMonat(jetztIso);
  d.monate[ym] = m;
  return m;
}

/** @param {Daten} d @param {string} ym @returns {string|null} */
export function letzterBefuellterMonatVor(d, ym) {
  const kandidaten = Object.keys(d.monate).filter((k) => k < ym && personenVon(d.monate[k]).length > 0).sort();
  return kandidaten.length ? kandidaten[kandidaten.length - 1] : null;
}

/**
 * Übernimmt Personen (optional inkl. Mengen) aus einem Vormonat in einen leeren Entwurf.
 * @param {Monat} quelle @param {Monat} ziel @param {boolean} mitMengen @param {() => string} idGen
 */
export function uebernehmeZeilen(quelle, ziel, mitMengen, idGen) {
  if (ziel.zeilen.length > 0) return;
  ziel.zeilen = personenVon(quelle).map((q) => (mitMengen ? { ...q, id: idGen() } : { ...leereZeile(idGen()), name: q.name, inko: q.inko }));
}

/** Aktuelle Zeilen, sonst die zuletzt gesendeten (Quelle für die Übernahme in Folgemonate). @param {Monat} m @returns {Zeile[]} */
export function personenVon(m) {
  return m.zeilen.length > 0 ? m.zeilen : m.gesendet ? m.gesendet.zeilen : [];
}

/**
 * Nach bestätigtem Senden/Speichern: Eingaben zurücksetzen, gesendeten Stand zur Wiederherstellung aufbewahren.
 * @param {Monat} m @param {Format} format @param {string} zeit
 */
export function schliesseAb(m, format, zeit) {
  const zeilen = m.zeilen.filter((z) => !istLeer(z));
  if (zeilen.length === 0) return;
  m.gesendet = { zeilen, zeit, format };
  m.zeilen = [];
  m.geaendert = zeit;
}

/** Holt die zuletzt gesendete Bestellung zurück (nur in einen leeren Monat). @param {Monat} m @param {string} zeit @returns {boolean} */
export function stelleGesendeteWiederHer(m, zeit) {
  if (!m.gesendet || m.zeilen.length > 0) return false;
  m.zeilen = m.gesendet.zeilen;
  m.gesendet = null;
  m.geaendert = zeit;
  return true;
}

/** @param {Zeile} z @param {ArtikelKey} k @returns {number} */
export function menge(z, k) {
  const v = z[k];
  return typeof v === 'number' ? v : v ? 1 : 0;
}

/** @param {Zeile[]} zeilen @returns {Record<ArtikelKey, number> & { inko: number, personen: number }} */
export function summen(zeilen) {
  const s = { ...nullmengen(), inko: 0, personen: 0 };
  zeilen.forEach((z) => {
    if (istLeer(z)) return;
    s.personen += 1;
    ARTIKEL.forEach((a) => { s[a.key] += menge(z, a.key); });
    if (z.inko.trim()) s.inko += 1;
  });
  return s;
}
