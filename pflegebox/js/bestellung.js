// @ts-check
// Layout des Bestellscheins im A4-Querformat (AERIS: Briefkopf, Summen- und Fußzeile). Dasselbe Layout wird
// auf eine PDF-Zeichenfläche (Vektor) oder eine Canvas-Zeichenfläche (JPG) gezeichnet.

import { ARTIKEL, istLeer, summen, ymText } from './model.js';
import { neuesDokument, passeEin } from './pdf.js';
import { neueLeinwand } from './leinwand.js';

const B = 842, H = 595, RAND = 36;
const LILA = '#702673', CYAN = '#00AEEF', GRAU = '#5f6368', LINIE = '#9aa0a6', ZEBRA = '#f4eef5';
const ZEILE_H = 18, KOPF_H = 24;
const TABELLE_Y = 150;
const FUSS_RESERVE = 40;
const LEGENDE_H = 52;

/** Erklärung der Spaltenkürzel für den Empfänger (zwei Spalten à drei Zeilen). */
const LEGENDE = Object.freeze([
  ['Handsch. S / M / L', 'Einmalhandschuhe, Größe S, M, L (Anzahl Packungen)'],
  ['Waschh.', 'Einmal-Waschhandschuhe'],
  ['Unterl.', 'Einmal-Krankenunterlagen'],
  ['Desinf. H / F', 'Desinfektionsmittel für Hände / Fläche'],
  ['Wipes H / F', 'Desinfektions-Wipes für Hände / Fläche'],
  ['X', 'wird benötigt; Inkontinenz = Freitext']
]);

/** Spaltenbreiten: Nr, Name, 9 Artikel, Inko → Summe = B − 2·RAND. */
const SPALTEN = (() => {
  const artikel = ARTIKEL.map(() => 52);
  const fest = 24 + 170 + artikel.reduce((a, b) => a + b, 0);
  return [24, 170, ...artikel, B - 2 * RAND - fest];
})();

/**
 * @typedef {import('./model.js').Daten} Daten
 * @typedef {import('./model.js').Monat} Monat
 * @typedef {import('./model.js').Zeile} Zeile
 * @typedef {import('./pdf.js').Zeichenflaeche} Zeichenflaeche
 */

/** @param {Date} d */
function datumZeit(d) {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ', ' +
    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
}

/** @param {Zeichenflaeche} doc */
function verlauf(doc) {
  const schritte = 48;
  const a = parseInt(LILA.slice(1), 16), c = parseInt(CYAN.slice(1), 16);
  for (let i = 0; i < schritte; i++) {
    const t = i / (schritte - 1);
    const mix = [16, 8, 0].map((s) => Math.round(((a >> s) & 255) * (1 - t) + ((c >> s) & 255) * t));
    const hex = '#' + mix.map((v) => v.toString(16).padStart(2, '0')).join('');
    doc.rechteck((B / schritte) * i, 0, B / schritte + 0.6, 54, { fuellung: hex });
  }
}

/** @param {Zeichenflaeche} doc @param {Daten} d @param {string} ym @param {Date} jetzt */
function briefkopf(doc, d, ym, jetzt) {
  verlauf(doc);
  doc.text(RAND, 34, 'Bestellformular Pflegehilfsmittel', { groesse: 18, fett: true, farbe: '#ffffff' });
  doc.text(B - RAND, 34, 'Monat: ' + ymText(ym), { groesse: 14, fett: true, farbe: '#ffffff', ausrichtung: 'rechts' });
  const abs = d.einstellungen.absender, lief = d.einstellungen.lieferant;
  const absZeilen = [abs.name, abs.strasse, abs.ort, abs.telefon ? 'Tel. ' + abs.telefon : ''].filter(Boolean);
  const liefZeilen = [lief.name, lief.kundennr ? 'Kunden-Nr. ' + lief.kundennr : '', lief.email].filter(Boolean);
  if (absZeilen.length) {
    doc.text(RAND, 74, 'Besteller', { groesse: 7.5, fett: true, farbe: GRAU });
    absZeilen.forEach((z, i) => doc.text(RAND, 86 + i * 11, passeEin(z, 250, 9, i === 0), { groesse: 9, fett: i === 0 }));
  }
  if (liefZeilen.length) {
    doc.text(310, 74, 'Lieferant', { groesse: 7.5, fett: true, farbe: GRAU });
    liefZeilen.forEach((z, i) => doc.text(310, 86 + i * 11, passeEin(z, 250, 9, i === 0), { groesse: 9, fett: i === 0 }));
  }
  doc.text(590, 74, 'Erstellt', { groesse: 7.5, fett: true, farbe: GRAU });
  doc.text(590, 86, datumZeit(jetzt), { groesse: 9 });
  doc.linie(RAND, 132, B - RAND, 132, LILA, 1.2);
}

/** @param {Zeichenflaeche} doc @param {number} y */
function tabellenkopf(doc, y) {
  const titel = ['Nr.', 'Name', ...ARTIKEL.map((a) => a.kurz), 'Inkontinenz'];
  let x = RAND;
  doc.rechteck(RAND, y, B - 2 * RAND, KOPF_H, { fuellung: LILA });
  titel.forEach((t, i) => {
    const w = SPALTEN[i];
    const links = i === 1 || i === titel.length - 1;
    doc.text(links ? x + 5 : x + w / 2, y + 15.5, passeEin(t, w - 6, 8, true), {
      groesse: 8, fett: true, farbe: '#ffffff', ausrichtung: links ? 'links' : 'mitte'
    });
    x += w;
  });
}

/** @param {Zeichenflaeche} doc @param {number} y @param {string[]} zellen @param {{ fett?: boolean, fuellung?: string }} opt */
function tabellenzeile(doc, y, zellen, opt) {
  if (opt.fuellung) doc.rechteck(RAND, y, B - 2 * RAND, ZEILE_H, { fuellung: opt.fuellung });
  let x = RAND;
  zellen.forEach((z, i) => {
    const w = SPALTEN[i];
    const links = i === 1 || i === zellen.length - 1;
    if (z) {
      doc.text(links ? x + 5 : x + w / 2, y + 12.5, passeEin(z, w - 8, 9, !!opt.fett), {
        groesse: 9, fett: !!opt.fett, ausrichtung: links ? 'links' : 'mitte'
      });
    }
    doc.linie(x, y, x, y + ZEILE_H, LINIE, 0.4);
    x += w;
  });
  doc.linie(x, y, x, y + ZEILE_H, LINIE, 0.4);
  doc.linie(RAND, y + ZEILE_H, B - RAND, y + ZEILE_H, LINIE, 0.4);
}

/** @param {Zeile} z @param {number} nr @returns {string[]} */
function zellen(z, nr) {
  return [String(nr), z.name, ...ARTIKEL.map((a) => {
    const v = z[a.key];
    return typeof v === 'number' ? (v > 0 ? String(v) : '') : v ? 'X' : '';
  }), z.inko];
}

/** @param {Zeichenflaeche} doc @param {number} y */
function legende(doc, y) {
  doc.text(RAND, y + 8, 'Legende', { groesse: 7.5, fett: true, farbe: GRAU });
  const spalteB = (B - 2 * RAND) / 2;
  LEGENDE.forEach(([kurz, text], i) => {
    const x = RAND + (i < 3 ? 0 : spalteB);
    const zy = y + 21 + (i % 3) * 11;
    doc.text(x, zy, kurz, { groesse: 8, fett: true });
    doc.text(x + 88, zy, passeEin(text, spalteB - 96, 8, false), { groesse: 8 });
  });
}

/** @param {Zeichenflaeche} doc @param {number} seite @param {number} gesamt @param {string} kennung */
function fusszeile(doc, seite, gesamt, kennung) {
  doc.linie(RAND, H - 28, B - RAND, H - 28, LINIE, 0.4);
  doc.text(RAND, H - 16, 'PflegeBox · ' + kennung + ' · vertraulich (enthält personenbezogene Daten)', { groesse: 7.5, farbe: GRAU });
  doc.text(B - RAND, H - 16, 'Seite ' + seite + ' von ' + gesamt, { groesse: 7.5, farbe: GRAU, ausrichtung: 'rechts' });
}

/**
 * Seitenumbruch-Plan: Anzahl Datenzeilen je Seite; Summenzeile und Legende stehen immer auf der letzten Seite.
 * @param {number} anzahl @returns {number[]}
 */
export function seitenplan(anzahl) {
  const erste = Math.floor((H - FUSS_RESERVE - TABELLE_Y - KOPF_H) / ZEILE_H);
  const folge = Math.floor((H - FUSS_RESERVE - RAND - KOPF_H) / ZEILE_H);
  const schluss = Math.ceil((ZEILE_H + 10 + LEGENDE_H) / ZEILE_H);
  /** @type {number[]} */
  const plan = [];
  let rest = anzahl;
  let kap = erste;
  while (rest + schluss > kap) {
    const n = Math.min(rest, kap);
    plan.push(n);
    rest -= n;
    kap = folge;
  }
  plan.push(rest);
  return plan;
}

/**
 * @param {Zeichenflaeche} doc @param {Daten} d @param {string} ym @param {Monat} m @param {Date} jetzt
 */
function zeichneBestellung(doc, d, ym, m, jetzt) {
  const zeilen = m.zeilen.filter((z) => !istLeer(z));
  const plan = seitenplan(zeilen.length);
  const kennung = 'Bestellung ' + ymText(ym);
  let idx = 0;
  plan.forEach((anzahl, s) => {
    if (s > 0) doc.seite();
    let y = RAND;
    if (s === 0) { briefkopf(doc, d, ym, jetzt); y = TABELLE_Y; }
    tabellenkopf(doc, y);
    y += KOPF_H;
    for (let i = 0; i < anzahl; i++, idx++) {
      tabellenzeile(doc, y, zellen(zeilen[idx], idx + 1), { fuellung: idx % 2 === 1 ? ZEBRA : undefined });
      y += ZEILE_H;
    }
    if (s === plan.length - 1) {
      const sum = summen(zeilen);
      tabellenzeile(doc, y, ['', 'Summe (' + sum.personen + ' Pers.)', ...ARTIKEL.map((a) => String(sum[a.key])),
        sum.inko ? sum.inko + ' Pers.' : ''], { fett: true, fuellung: '#e6f6fd' });
      doc.linie(RAND, y, B - RAND, y, LILA, 1.2);
      legende(doc, y + ZEILE_H + 10);
    }
    fusszeile(doc, s + 1, plan.length, kennung);
  });
}

/**
 * @param {Daten} d @param {string} ym @param {Monat} m @param {Date} jetzt @returns {Uint8Array<ArrayBuffer>}
 */
export function erzeugeBestellPdf(d, ym, m, jetzt) {
  const doc = neuesDokument(B, H);
  zeichneBestellung(doc, d, ym, m, jetzt);
  return doc.bytes('Bestellung Pflegehilfsmittel ' + ymText(ym), jetzt);
}

/**
 * JPG (Seiten untereinander, 2-fache Auflösung ≈ 144 dpi). Nur im Browser (Canvas).
 * @param {Daten} d @param {string} ym @param {Monat} m @param {Date} jetzt @returns {Uint8Array<ArrayBuffer>}
 */
export function erzeugeBestellJpeg(d, ym, m, jetzt) {
  const leinwand = neueLeinwand(B, H, 2);
  zeichneBestellung(leinwand, d, ym, m, jetzt);
  return leinwand.jpeg(0.9);
}

/** @param {string} ym @param {'pdf'|'jpg'} endung */
export function dateiname(ym, endung) {
  return 'Bestellung_' + ym + '.' + endung;
}
