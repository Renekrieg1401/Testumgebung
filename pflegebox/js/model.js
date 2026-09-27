// @ts-check
// Fachliches Datenmodell der PflegeBox (rein, ohne DOM/I/O).
// Übernommene AERIS-Logik: schema-versionierter Datenbestand mit zentralem Migrations-Sicherheitsnetz,
// einmalig vergebene und danach stabile Belegnummern (vgl. getOrAssignRechnungsnr), Versiegelung mit
// Unterschrift + Änderungsprotokoll (vgl. Tages-/Monatsfreigabe) und Budgetberechnung in Cent.

export const SCHEMA = 2;
export const MAX_ZEILEN = 60;
export const MAX_PACKUNGEN = 5;
export const PROTOKOLL_MAX = 50;
/** Monatliche Pauschale für zum Verbrauch bestimmte Pflegehilfsmittel, § 40 Abs. 2 SGB XI (seit 01.01.2025). */
export const BUDGET_STANDARD_CENT = 4200;

export const MONATSNAMEN = Object.freeze([
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
]);

/**
 * @typedef {'hs'|'hm'|'hl'|'wh'|'ul'|'dh'|'df'|'wph'|'wpf'} ArtikelKey
 * @typedef {{ key: ArtikelKey, label: string, kurz: string, typ: 'menge'|'check' }} Artikel
 */

/** Artikel, die aus der Pauschale nach § 40 Abs. 2 SGB XI bezahlt werden. Inkontinenzmaterial (SGB V) bewusst nicht. */
export const ARTIKEL = /** @type {ReadonlyArray<Artikel>} */ (Object.freeze([
  { key: 'hs', label: 'Einmalhandschuhe Gr. S', kurz: 'Handsch. S', typ: 'menge' },
  { key: 'hm', label: 'Einmalhandschuhe Gr. M', kurz: 'Handsch. M', typ: 'menge' },
  { key: 'hl', label: 'Einmalhandschuhe Gr. L', kurz: 'Handsch. L', typ: 'menge' },
  { key: 'wh', label: 'Einmal-Waschhandschuhe', kurz: 'Waschh.', typ: 'check' },
  { key: 'ul', label: 'Bettschutzeinlagen (Unterlagen)', kurz: 'Unterl.', typ: 'check' },
  { key: 'dh', label: 'Händedesinfektion', kurz: 'Desinf. H', typ: 'check' },
  { key: 'df', label: 'Flächendesinfektion', kurz: 'Desinf. F', typ: 'check' },
  { key: 'wph', label: 'Desinfektionstücher Hände', kurz: 'Wipes H', typ: 'check' },
  { key: 'wpf', label: 'Desinfektionstücher Flächen', kurz: 'Wipes F', typ: 'check' }
]));

/**
 * @typedef {{
 *   id: string, name: string,
 *   hs: number, hm: number, hl: number,
 *   wh: boolean, ul: boolean, dh: boolean, df: boolean, wph: boolean, wpf: boolean,
 *   inko: string
 * }} Zeile
 * @typedef {{ name: string, sig: string, zeit: string }} Siegel
 * @typedef {{ zeit: string, aktion: string }} ProtokollEintrag
 * @typedef {{
 *   zeilen: Zeile[], status: 'entwurf'|'versiegelt', bestellnr: string|null,
 *   siegel: Siegel|null, protokoll: ProtokollEintrag[], geaendert: string
 * }} Monat
 * @typedef {{ name: string, strasse: string, ort: string, telefon: string }} Anschrift
 * @typedef {{ name: string, email: string, kundennr: string }} Lieferant
 * @typedef {{
 *   absender: Anschrift, lieferant: Lieferant, budgetCent: number,
 *   preiseCent: Record<ArtikelKey, number>
 * }} Einstellungen
 * @typedef {{
 *   schema: number, einstellungen: Einstellungen, monate: Record<string, Monat>,
 *   zaehler: Record<string, number>, aktuellerMonat: string
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
function leerePreise() {
  return { hs: 0, hm: 0, hl: 0, wh: 0, ul: 0, dh: 0, df: 0, wph: 0, wpf: 0 };
}

/** @param {Date} jetzt @returns {Daten} */
export function standardDaten(jetzt) {
  return {
    schema: SCHEMA,
    einstellungen: {
      absender: { name: '', strasse: '', ort: '', telefon: '' },
      lieferant: { name: '', email: '', kundennr: '' },
      budgetCent: BUDGET_STANDARD_CENT,
      preiseCent: leerePreise()
    },
    monate: {},
    zaehler: {},
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
  return { zeilen: [], status: 'entwurf', bestellnr: null, siegel: null, protokoll: [], geaendert: jetztIso };
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

/** @param {unknown} v @returns {Siegel|null} */
function normSiegel(v) {
  if (!istObjekt(v)) return null;
  const sig = text(v.sig, 400000);
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(sig)) return null;
  return { name: text(v.name, 80), sig, zeit: text(v.zeit, 40) };
}

/** @param {unknown} v @param {string} ym @param {string} jetztIso @returns {Monat} */
function normMonat(v, ym, jetztIso) {
  const o = istObjekt(v) ? v : {};
  const roh = Array.isArray(o.zeilen) ? o.zeilen.slice(0, MAX_ZEILEN) : [];
  /** @type {Set<string>} */
  const ids = new Set();
  const zeilen = roh.map((z, i) => {
    const zeile = normZeile(z, 'm' + ym.replace('-', '') + 'r' + i);
    if (ids.has(zeile.id)) zeile.id = 'm' + ym.replace('-', '') + 'r' + i;
    ids.add(zeile.id);
    return zeile;
  }).filter((z) => !istLeer(z));
  const siegel = normSiegel(o.siegel);
  const versiegelt = o.status === 'versiegelt' && siegel !== null;
  const protokoll = Array.isArray(o.protokoll)
    ? o.protokoll.filter(istObjekt).slice(-PROTOKOLL_MAX).map((p) => ({ zeit: text(p.zeit, 40), aktion: text(p.aktion, 200) }))
    : [];
  return {
    zeilen, status: versiegelt ? 'versiegelt' : 'entwurf',
    bestellnr: typeof o.bestellnr === 'string' && /^BS-\d{4}-\d{3,}$/.test(o.bestellnr) ? o.bestellnr : null,
    siegel: versiegelt ? siegel : null, protokoll,
    geaendert: text(o.geaendert, 40) || jetztIso
  };
}

/** @param {unknown} v @returns {Einstellungen} */
function normEinstellungen(v) {
  const o = istObjekt(v) ? v : {};
  const abs = istObjekt(o.absender) ? o.absender : {};
  const lief = istObjekt(o.lieferant) ? o.lieferant : {};
  const preiseRoh = istObjekt(o.preiseCent) ? o.preiseCent : {};
  const preiseCent = leerePreise();
  ARTIKEL.forEach((a) => { preiseCent[a.key] = ganzzahl(preiseRoh[a.key], 0, 100000); });
  return {
    absender: { name: text(abs.name, 120), strasse: text(abs.strasse, 120), ort: text(abs.ort, 120), telefon: text(abs.telefon, 60) },
    lieferant: { name: text(lief.name, 120), email: text(lief.email, 120), kundennr: text(lief.kundennr, 60) },
    budgetCent: o.budgetCent === undefined ? BUDGET_STANDARD_CENT : ganzzahl(o.budgetCent, 0, 100000),
    preiseCent
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
  /** @type {Record<string, number>} */
  const zaehler = {};
  if (istObjekt(o.zaehler)) {
    Object.keys(o.zaehler).filter((j) => /^\d{4}$/.test(j)).forEach((j) => {
      zaehler[j] = ganzzahl(/** @type {Record<string, unknown>} */ (o.zaehler)[j], 0, 999999);
    });
  }
  return {
    schema: SCHEMA,
    einstellungen: normEinstellungen(o.einstellungen),
    monate, zaehler,
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
  monat.protokoll.push({ zeit: jetzt.toISOString(), aktion: 'Aus unverschlüsseltem Altbestand übernommen' });
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
  const kandidaten = Object.keys(d.monate).filter((k) => k < ym && d.monate[k].zeilen.length > 0).sort();
  return kandidaten.length ? kandidaten[kandidaten.length - 1] : null;
}

/**
 * Übernimmt Personen (optional inkl. Mengen) aus einem Vormonat in einen leeren Entwurf.
 * @param {Monat} quelle @param {Monat} ziel @param {boolean} mitMengen @param {() => string} idGen
 */
export function uebernehmeZeilen(quelle, ziel, mitMengen, idGen) {
  if (ziel.status !== 'entwurf' || ziel.zeilen.length > 0) return;
  ziel.zeilen = quelle.zeilen.map((q) => (mitMengen ? { ...q, id: idGen() } : { ...leereZeile(idGen()), name: q.name, inko: q.inko }));
}

/**
 * Einmalige, stabile Bestellnummer je Monat (AERIS: getOrAssignRechnungsnr).
 * @param {Daten} d @param {string} ym @param {Monat} monat @returns {string}
 */
export function vergibBestellnr(d, ym, monat) {
  if (monat.bestellnr) return monat.bestellnr;
  const jahr = ym.slice(0, 4);
  const lfd = (d.zaehler[jahr] || 0) + 1;
  d.zaehler[jahr] = lfd;
  monat.bestellnr = 'BS-' + jahr + '-' + String(lfd).padStart(3, '0');
  return monat.bestellnr;
}

/** @param {Monat} m @param {string} zeit @param {string} aktion */
export function protokolliere(m, zeit, aktion) {
  m.protokoll.push({ zeit, aktion });
  if (m.protokoll.length > PROTOKOLL_MAX) m.protokoll.splice(0, m.protokoll.length - PROTOKOLL_MAX);
}

/** @param {Daten} d @param {string} ym @param {Monat} m @param {Siegel} siegel */
export function versiegle(d, ym, m, siegel) {
  if (m.status === 'versiegelt') return;
  vergibBestellnr(d, ym, m);
  m.status = 'versiegelt';
  m.siegel = siegel;
  m.geaendert = siegel.zeit;
  protokolliere(m, siegel.zeit, 'Versiegelt und unterschrieben von ' + (siegel.name || 'unbekannt') + ' (' + m.bestellnr + ')');
}

/** @param {Monat} m @param {string} zeit */
export function entsiegle(m, zeit) {
  if (m.status !== 'versiegelt') return;
  const wer = m.siegel ? m.siegel.name : '';
  m.status = 'entwurf';
  m.siegel = null;
  m.geaendert = zeit;
  protokolliere(m, zeit, 'Versiegelung aufgehoben (vorher unterschrieben von ' + (wer || 'unbekannt') + ')');
}

/** @param {Zeile} z @param {ArtikelKey} k @returns {number} */
export function menge(z, k) {
  const v = z[k];
  return typeof v === 'number' ? v : v ? 1 : 0;
}

/** @param {Zeile[]} zeilen @returns {Record<ArtikelKey, number> & { inko: number, personen: number }} */
export function summen(zeilen) {
  const s = { ...leerePreise(), inko: 0, personen: 0 };
  zeilen.forEach((z) => {
    if (istLeer(z)) return;
    s.personen += 1;
    ARTIKEL.forEach((a) => { s[a.key] += menge(z, a.key); });
    if (z.inko.trim()) s.inko += 1;
  });
  return s;
}

/** @param {Einstellungen} e @returns {boolean} */
export function preiseHinterlegt(e) { return ARTIKEL.some((a) => e.preiseCent[a.key] > 0); }

/**
 * @param {Zeile} z @param {Einstellungen} e
 * @returns {{ kostenCent: number, budgetCent: number, restCent: number, ueberschritten: boolean }}
 */
export function budgetZeile(z, e) {
  const kostenCent = ARTIKEL.reduce((sum, a) => sum + menge(z, a.key) * e.preiseCent[a.key], 0);
  return { kostenCent, budgetCent: e.budgetCent, restCent: e.budgetCent - kostenCent, ueberschritten: kostenCent > e.budgetCent };
}

/** @param {number} cent @returns {string} */
export function euro(cent) {
  const neg = cent < 0;
  const abs = Math.abs(Math.round(cent));
  const ganz = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '−' : '') + ganz + ',' + pad2(abs % 100) + ' €';
}

/** @param {string} eingabe @returns {number|null} Cent oder null bei ungültiger Eingabe */
export function parseEuro(eingabe) {
  const s = eingabe.replace(/\s|€/g, '');
  if (s === '') return 0;
  const m = /^(\d{1,5})(?:[.,](\d{1,2}))?$/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 100 + (m[2] ? Number(m[2].padEnd(2, '0')) : 0);
}
