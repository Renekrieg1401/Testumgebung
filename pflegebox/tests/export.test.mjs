import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { csvZelle, erzeugeMonatsCsv } from '../js/csv.js';
import { erzeugeBestellPdf, pdfDateiname, seitenplan } from '../js/bestellung-pdf.js';
import { jpegInfo, passeEin, textBreite, winAnsi } from '../js/pdf.js';
import { leereZeile, neuerMonat, standardDaten, versiegle } from '../js/model.js';

const JETZT = new Date('2026-09-27T10:00:00Z');
// 1×1-Pixel-JPEG (Graustufen, baseline)
const JPEG_B64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

function beispiel(anzahl) {
  const d = standardDaten(JETZT);
  d.einstellungen.absender = { name: 'Pflegedienst Sonnenschein', strasse: 'Hauptstraße 1', ort: '35232 Dautphetal', telefon: '06466 123' };
  d.einstellungen.lieferant = { name: 'Sanitätshaus Müller', email: 'bestellung@example.org', kundennr: 'K-4711' };
  d.einstellungen.preiseCent.hm = 890;
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

test('CSV: BOM, Semikolon, Escaping, Formel-Injection-Schutz, Summen/Budget', () => {
  assert.equal(csvZelle('a"b'), '"a""b"');
  assert.equal(csvZelle('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvZelle('@SUM(A1)'), '"\'@SUM(A1)"');
  const { d, m } = beispiel(3);
  m.zeilen[1].name = '=cmd|calc';
  const csv = erzeugeMonatsCsv(d, '2026-09', m, JETZT);
  assert.ok(csv.startsWith('﻿'));
  assert.ok(csv.includes('"\'=cmd|calc"'));
  assert.ok(csv.includes('"Summe (3 Personen)"'));
  assert.ok(csv.includes('"Kosten § 40 Abs. 2 SGB XI"'));
  assert.ok(csv.includes('"8,90 €"'));
  assert.ok(csv.endsWith('\r\n'));
});

test('PDF-Hilfen: WinAnsi, Textbreite, Kürzen, JPEG-Header', () => {
  assert.deepEqual(winAnsi('Ä€–✓'), [0xc4, 0x80, 0x96, 0x3f]);
  assert.equal(textBreite('0000', 10, false), 22.24);
  const k = passeEin('Sehr langer Name einer Person', 60, 10, false);
  assert.ok(k.endsWith('…') && textBreite(k, 10, false) <= 60);
  const bytes = Uint8Array.from(Buffer.from(JPEG_B64, 'base64'));
  assert.deepEqual(jpegInfo(bytes), { hoehe: 1, breite: 1, komponenten: 1 });
  assert.equal(jpegInfo(new Uint8Array([1, 2, 3])), null);
});

test('Seitenplan: Summen-/Unterschriftsblock passt immer auf die letzte Seite', () => {
  assert.deepEqual(seitenplan(0), [0]);
  assert.deepEqual(seitenplan(15), [15]);
  const plan = seitenplan(60);
  assert.equal(plan.reduce((a, b) => a + b, 0), 60);
  assert.ok(plan.length >= 3);
});

test('PDF ist gültig, enthält Briefkopf, Zeilen, Summe; Entwurf ohne Unterschrift', async () => {
  const { d, m } = beispiel(4);
  const bytes = erzeugeBestellPdf(d, '2026-09', m, JETZT);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 8)), '%PDF-1.4');
  const [text] = await pdfText(bytes);
  for (const s of ['Bestellformular Pflegehilfsmittel', 'Monat: September 2026', 'Pflegedienst Sonnenschein', 'Sanitätshaus Müller',
    'Kunden-Nr. K-4711', 'Person Ä(0)', 'Pants Gr. M', 'Summe (4 Pers.)', 'Entwurf', 'Seite 1 von 1']) {
    assert.ok(text.includes(s), 'fehlt: ' + s + '\n' + text);
  }
  assert.equal(pdfDateiname('2026-09', m), 'Bestellung_2026-09_Entwurf.pdf');
});

test('PDF versiegelt: Bestellnummer, Unterschriftsbild, Mehrseitigkeit', async () => {
  const { d, m } = beispiel(45);
  versiegle(d, '2026-09', m, { name: 'Anna Muster', sig: 'data:image/jpeg;base64,' + JPEG_B64, zeit: JETZT.toISOString() });
  const bytes = erzeugeBestellPdf(d, '2026-09', m, JETZT);
  const roh = Buffer.from(bytes).toString('latin1');
  assert.ok(roh.includes('/Filter /DCTDecode'));
  const seiten = await pdfText(bytes);
  assert.ok(seiten.length >= 2);
  assert.ok(seiten[0].includes('BS-2026-001'));
  const letzte = seiten[seiten.length - 1];
  assert.ok(letzte.includes('Anna Muster') && letzte.includes('Summe (45 Pers.)'), letzte);
  assert.ok(letzte.includes('Seite ' + seiten.length + ' von ' + seiten.length));
  assert.ok(seiten.join(' ').includes('Person Ä(44)'));
  assert.equal(pdfDateiname('2026-09', m), 'Bestellung_2026-09_BS-2026-001.pdf');
});
