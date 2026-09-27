import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  istLeer, leereZeile, letzterBefuellterMonatVor, migriereAltbestand, neuerMonat,
  normalisiereDaten, standardDaten, summen, uebernehmeZeilen, ymText, ymVerschieben
} from '../js/model.js';

const JETZT = new Date('2026-09-27T10:00:00Z');

test('Monatsarithmetik über Jahresgrenzen', () => {
  assert.equal(ymVerschieben('2026-01', -1), '2025-12');
  assert.equal(ymVerschieben('2026-12', 1), '2027-01');
  assert.equal(ymVerschieben('2026-05', -17), '2024-12');
  assert.equal(ymText('2026-03'), 'März 2026');
});

test('Summen (Inko als Personenanzahl)', () => {
  const z1 = { ...leereZeile('a'), name: 'Frau A', hm: 3, dh: true, inko: 'Pants M' };
  const z2 = { ...leereZeile('b'), name: 'Herr B', hm: 1 };
  const s = summen([z1, z2, leereZeile('c')]);
  assert.equal(s.personen, 2);
  assert.equal(s.hm, 4);
  assert.equal(s.dh, 1);
  assert.equal(s.inko, 1);
});

test('Übernahme aus Vormonat (nur Personen / mit Mengen)', () => {
  const d = standardDaten(JETZT);
  const quelle = neuerMonat(JETZT.toISOString());
  quelle.zeilen.push({ ...leereZeile('a'), name: 'Frau A', hs: 2, wh: true, inko: 'Vorlage' });
  d.monate['2026-08'] = quelle;
  assert.equal(letzterBefuellterMonatVor(d, '2026-09'), '2026-08');
  assert.equal(letzterBefuellterMonatVor(d, '2026-08'), null);
  let n = 0;
  const ziel = neuerMonat(JETZT.toISOString());
  uebernehmeZeilen(quelle, ziel, false, () => 'n' + n++);
  assert.deepEqual(ziel.zeilen[0], { ...leereZeile('n0'), name: 'Frau A', inko: 'Vorlage' });
  const ziel2 = neuerMonat(JETZT.toISOString());
  uebernehmeZeilen(quelle, ziel2, true, () => 'n' + n++);
  assert.equal(ziel2.zeilen[0].hs, 2);
  assert.equal(ziel2.zeilen[0].wh, true);
  assert.notEqual(ziel2.zeilen[0].id, 'a');
});

test('Normalisierung verwirft/klemmt ungültige Werte (Vertrauensgrenze)', () => {
  const d = normalisiereDaten({
    einstellungen: { absender: { name: 42 }, lieferant: { name: 'x'.repeat(500) } },
    monate: {
      '2026-13': { zeilen: [{ name: 'x' }] },
      '2026-09': { zeilen: [{ id: 'a', name: 'A', hs: 99, wh: 'ja' }, { id: 'a', name: 'B' }, {}] }
    },
    aktuellerMonat: 'x'
  }, JETZT);
  assert.equal(d.einstellungen.absender.name, '');
  assert.equal(d.einstellungen.lieferant.name.length, 120);
  assert.deepEqual(Object.keys(d.monate), ['2026-09']);
  const m = d.monate['2026-09'];
  assert.equal(m.zeilen.length, 2, 'leere Zeile entfernt');
  assert.equal(m.zeilen[0].hs, 5);
  assert.equal(m.zeilen[0].wh, false);
  assert.notEqual(m.zeilen[0].id, m.zeilen[1].id, 'doppelte IDs werden aufgelöst');
  assert.equal(d.aktuellerMonat, '2026-09');
});

test('Migration des Klartext-Altbestands (Bestellschein v1)', () => {
  const alt = { monat: 'Oktober', 'name-0': 'Frau A', 's-0': '2', 'm-0': '0', 'l-0': '0', 'wh-0': true, 'dh-0': true,
    'inko-0': 'Pants', 'name-1': '', 's-1': '0', 'name-5': 'Herr B', 'l-5': '1', 'wpf-5': true };
  const d = migriereAltbestand(alt, JETZT);
  assert.ok(d);
  assert.equal(d.aktuellerMonat, '2026-10');
  const m = d.monate['2026-10'];
  assert.equal(m.zeilen.length, 2);
  assert.deepEqual(m.zeilen[0], { ...leereZeile('alt0'), name: 'Frau A', hs: 2, wh: true, dh: true, inko: 'Pants' });
  assert.equal(m.zeilen[1].hl, 1);
  assert.equal(m.zeilen[1].wpf, true);
  assert.equal(migriereAltbestand({ monat: 'Juni' }, new Date('2026-01-15T00:00:00Z'))?.aktuellerMonat, '2026-06');
  assert.equal(migriereAltbestand({ monat: 'Dezember' }, new Date('2026-01-15T00:00:00Z'))?.aktuellerMonat, '2025-12');
  assert.equal(migriereAltbestand(null, JETZT), null);
  assert.ok(istLeer(leereZeile('x')));
});

test('Abschluss nach Senden: zurücksetzen, aufbewahren, wiederherstellen, als Übernahmequelle nutzen', async () => {
  const { schliesseAb, stelleGesendeteWiederHer, personenVon } = await import('../js/model.js');
  const d = standardDaten(JETZT);
  const m = neuerMonat(JETZT.toISOString());
  m.zeilen.push({ ...leereZeile('a'), name: 'Frau A', hs: 2 }, leereZeile('leer'));
  d.monate['2026-09'] = m;
  schliesseAb(m, 'JPG', '2026-09-27T12:00:00.000Z');
  assert.equal(m.zeilen.length, 0);
  assert.equal(m.gesendet?.format, 'JPG');
  assert.equal(m.gesendet?.zeilen.length, 1, 'leere Zeilen werden nicht aufbewahrt');
  assert.equal(personenVon(m)[0].name, 'Frau A');
  assert.equal(letzterBefuellterMonatVor(d, '2026-10'), '2026-09');
  const n = normalisiereDaten(JSON.parse(JSON.stringify(d)), JETZT);
  assert.equal(n.monate['2026-09'].gesendet?.zeilen[0].hs, 2, 'gesendeter Stand übersteht Speichern/Laden');
  schliesseAb(m, 'PDF', 'x');
  assert.equal(m.gesendet?.format, 'JPG', 'leerer Monat überschreibt die Aufbewahrung nicht');
  m.zeilen.push({ ...leereZeile('b'), name: 'Neu' });
  assert.equal(stelleGesendeteWiederHer(m, 'y'), false, 'nicht über neue Eingaben');
  m.zeilen = [];
  assert.equal(stelleGesendeteWiederHer(m, 'y'), true);
  assert.equal(m.zeilen[0].name, 'Frau A');
  assert.equal(m.gesendet, null);
});
