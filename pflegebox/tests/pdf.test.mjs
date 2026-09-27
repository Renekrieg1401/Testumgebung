import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { dateiname, erzeugeBestellPdf, seitenplan } from '../js/bestellung.js';
import { passeEin, textBreite, winAnsi } from '../js/pdf.js';
import { leereZeile, neuerMonat, standardDaten } from '../js/model.js';

const JETZT = new Date('2026-09-27T10:00:00Z');

function beispiel(anzahl) {
  const d = standardDaten(JETZT);
  d.einstellungen.absender = { name: 'Pflegedienst Sonnenschein', strasse: 'Hauptstraße 1', ort: '35232 Dautphetal', telefon: '06466 123' };
  d.einstellungen.lieferant = { name: 'Sanitätshaus Müller', email: 'bestellung@example.org', kundennr: 'K-4711' };
  const m = neuerMonat(JETZT.toISOString());
  for (let i = 0; i < anzahl; i++) m.zeilen.push({ ...leereZeile('z' + i), name: 'Person Ä(' + i + ')', hm: (i % 5) + 1, wh: i % 2 === 0, inko: i === 0 ? 'Pants Gr. M' : '' });
  return { d, m };
}

async function pdfText(bytes) {
  const doc = await getDocument({ data: bytes, useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
  const seiten = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    seiten.push(tc.items.map((it) => it.str).join(' '));
  }
  return seiten;
}

test('PDF-Hilfen: WinAnsi, Textbreite, Kürzen', () => {
  assert.deepEqual(winAnsi('Ä€–✓'), [0xc4, 0x80, 0x96, 0x3f]);
  assert.equal(textBreite('0000', 10, false), 22.24);
  const k = passeEin('Sehr langer Name einer Person', 60, 10, false);
  assert.ok(k.endsWith('…') && textBreite(k, 10, false) <= 60);
});

test('Seitenplan: Summenzeile steht immer auf der letzten Seite', () => {
  assert.deepEqual(seitenplan(0), [0]);
  assert.deepEqual(seitenplan(15), [15]);
  const plan = seitenplan(60);
  assert.equal(plan.reduce((a, b) => a + b, 0), 60);
  assert.ok(plan.length >= 2);
});

test('PDF ist gültig und enthält Briefkopf, Zeilen, Summe', async () => {
  const { d, m } = beispiel(4);
  const bytes = erzeugeBestellPdf(d, '2026-09', m, JETZT);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 8)), '%PDF-1.4');
  const [text] = await pdfText(bytes);
  for (const s of ['Bestellformular Pflegehilfsmittel', 'Monat: September 2026', 'Pflegedienst Sonnenschein', 'Sanitätshaus Müller',
    'Kunden-Nr. K-4711', 'Person Ä(0)', 'Pants Gr. M', 'Summe (4 Pers.)', 'Seite 1 von 1',
    'Legende', 'Einmal-Krankenunterlagen', 'Desinfektionsmittel für Hände / Fläche', 'Desinfektions-Wipes für Hände / Fläche',
    'Einmalhandschuhe, Größe S, M, L (Anzahl Packungen)', 'wird benötigt; Inkontinenz = Freitext']) {
    assert.ok(text.includes(s), 'fehlt: ' + s + '\n' + text);
  }
  assert.equal(dateiname('2026-09', 'pdf'), 'Bestellung_2026-09.pdf');
  assert.equal(dateiname('2026-09', 'jpg'), 'Bestellung_2026-09.jpg');
});

test('PDF mehrseitig mit Seitenzählung', async () => {
  const { d, m } = beispiel(45);
  const seiten = await pdfText(erzeugeBestellPdf(d, '2026-09', m, JETZT));
  assert.ok(seiten.length >= 2);
  const letzte = seiten[seiten.length - 1];
  assert.ok(letzte.includes('Summe (45 Pers.)'), letzte);
  assert.ok(letzte.includes('Legende') && !seiten[0].includes('Legende'), 'Legende nur auf der letzten Seite');
  assert.ok(letzte.includes('Seite ' + seiten.length + ' von ' + seiten.length));
  assert.ok(seiten.join(' ').includes('Person Ä(44)'));
});
