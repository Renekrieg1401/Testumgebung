// @ts-check
// Layout des Bestellscheins als A4-Querformat-PDF (AERIS: Briefkopf, Summen-/Fußzeile, Unterschriftsblock).

import { ARTIKEL, istLeer, summen, ymText } from './model.js';
import { ausB64 } from './crypto.js';
import { neuesDokument, passeEin } from './pdf.js';

const B = 842, H = 595, RAND = 36;
const LILA = '#702673', CYAN = '#00AEEF', GRAU = '#5f6368', LINIE = '#9aa0a6', ZEBRA = '#f4eef5';
const ZEILE_H = 18, KOPF_H = 24;
const TABELLE_Y = 150;
const FUSS_RESERVE = 40;
const SIGNATUR_H = 78;

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
 * @typedef {import('./pdf.js').PdfDokument} PdfDokument
 */

/** @param {Date} d */
function datumZeit(d) {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ', ' +
    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
}

/** @param {PdfDokument} doc */
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

/** @param {PdfDokument} doc @param {Daten} d @param {string} ym @param {Monat} m @param {Date} jetzt */
function briefkopf(doc, d, ym, m, jetzt) {
  verlauf(doc);
  doc.text(RAND, 34, 'Bestellformular Pflegehilfsmittel', { groesse: 18, fett: true, farbe: '#ffffff' });
  doc.text(B - RAND, 34, 'Monat: ' + ymText(ym), { groesse: 14, fett: true, farbe: '#ffffff', ausrichtung: 'rechts' });
  const abs = d.einstellungen.absender, lief = d.einstellungen.lieferant;
  const absZeilen = [abs.name, abs.strasse, abs.ort, abs.telefon ? 'Tel. ' + abs.telefon : ''].filter(Boolean);
  const liefZeilen = [lief.name, lief.kundennr ? 'Kunden-Nr. ' + lief.kundennr : '', lief.email].filter(Boolean);
  doc.text(RAND, 74, 'Besteller', { groesse: 7.5, fett: true, farbe: GRAU });
  absZeilen.forEach((z, i) => doc.text(RAND, 86 + i * 11, passeEin(z, 250, 9, i === 0), { groesse: 9, fett: i === 0 }));
  doc.text(310, 74, 'Lieferant', { groesse: 7.5, fett: true, farbe: GRAU });
  liefZeilen.forEach((z, i) => doc.text(310, 86 + i * 11, passeEin(z, 250, 9, i === 0), { groesse: 9, fett: i === 0 }));
  const status = m.status === 'versiegelt' ? 'versiegelt' : 'Entwurf';
  const meta = [
    ['Bestell-Nr.', m.bestellnr || '— (wird beim Versiegeln vergeben)'],
    ['Status', status],
    ['Erstellt', datumZeit(jetzt)]
  ];
  meta.forEach(([k, v], i) => {
    doc.text(590, 86 + i * 11, k, { groesse: 8, fett: true, farbe: GRAU });
    doc.text(650, 86 + i * 11, passeEin(v, B - RAND - 650, 9, false), { groesse: 9 });
  });
  doc.linie(RAND, 132, B - RAND, 132, LILA, 1.2);
}

/** @param {PdfDokument} doc @param {number} y */
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

/** @param {PdfDokument} doc @param {number} y @param {string[]} zellen @param {{ fett?: boolean, fuellung?: string }} opt */
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

/** @param {PdfDokument} doc @param {number} y @param {Monat} m */
function unterschrift(doc, y, m) {
  doc.text(RAND, y + 10, 'Unterschrift', { groesse: 7.5, fett: true, farbe: GRAU });
  if (m.status === 'versiegelt' && m.siegel) {
    const jpeg = ausB64(m.siegel.sig.slice(m.siegel.sig.indexOf(',') + 1));
    doc.bild(jpeg, RAND, y + 14, 180, 44);
    doc.linie(RAND, y + 60, RAND + 220, y + 60, '#000000', 0.6);
    doc.text(RAND, y + 71, passeEin(m.siegel.name + ', ' + datumZeit(new Date(m.siegel.zeit)), 300, 8.5, false), { groesse: 8.5 });
  } else {
    doc.linie(RAND, y + 60, RAND + 220, y + 60, '#000000', 0.6);
    doc.text(RAND, y + 71, 'Entwurf — noch nicht versiegelt/unterschrieben', { groesse: 8.5, farbe: GRAU });
  }
}

/** @param {PdfDokument} doc @param {number} seite @param {number} gesamt @param {string} kennung */
function fusszeile(doc, seite, gesamt, kennung) {
  doc.linie(RAND, H - 28, B - RAND, H - 28, LINIE, 0.4);
  doc.text(RAND, H - 16, 'PflegeBox · ' + kennung + ' · vertraulich (enthält personenbezogene Daten)', { groesse: 7.5, farbe: GRAU });
  doc.text(B - RAND, H - 16, 'Seite ' + seite + ' von ' + gesamt, { groesse: 7.5, farbe: GRAU, ausrichtung: 'rechts' });
}

/**
 * Seitenumbruch-Plan: Anzahl Datenzeilen je Seite; Summen- und Unterschriftsblock auf der letzten Seite.
 * @param {number} anzahl @returns {number[]}
 */
export function seitenplan(anzahl) {
  const erste = Math.floor((H - FUSS_RESERVE - TABELLE_Y - KOPF_H) / ZEILE_H);
  const folge = Math.floor((H - FUSS_RESERVE - RAND - KOPF_H) / ZEILE_H);
  const schluss = Math.ceil((ZEILE_H + SIGNATUR_H + 8) / ZEILE_H);
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
 * @param {Daten} d @param {string} ym @param {Monat} m @param {Date} jetzt @returns {Uint8Array<ArrayBuffer>}
 */
export function erzeugeBestellPdf(d, ym, m, jetzt) {
  const zeilen = m.zeilen.filter((z) => !istLeer(z));
  const plan = seitenplan(zeilen.length);
  const doc = neuesDokument(B, H);
  const kennung = m.bestellnr || 'Entwurf ' + ymText(ym);
  let idx = 0;
  plan.forEach((anzahl, s) => {
    if (s > 0) doc.seite();
    let y = RAND;
    if (s === 0) { briefkopf(doc, d, ym, m, jetzt); y = TABELLE_Y; }
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
      unterschrift(doc, y + ZEILE_H + 8, m);
    }
    fusszeile(doc, s + 1, plan.length, kennung);
  });
  return doc.bytes('Bestellung Pflegehilfsmittel ' + ymText(ym), jetzt);
}

/** @param {string} ym @param {Monat} m */
export function pdfDateiname(ym, m) {
  return 'Bestellung_' + ym + (m.bestellnr ? '_' + m.bestellnr : '_Entwurf') + '.pdf';
}
