import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  budgetZeile, entsiegle, euro, istLeer, leereZeile, letzterBefuellterMonatVor, migriereAltbestand, neuerMonat,
  normalisiereDaten, parseEuro, standardDaten, summen, uebernehmeZeilen, vergibBestellnr, versiegle, ymText, ymVerschieben
} from '../js/model.js';

const JETZT = new Date('2026-09-27T10:00:00Z');
const SIG = 'data:image/jpeg;base64,/9j/AAAA';

test('Monatsarithmetik über Jahresgrenzen', () => {
  assert.equal(ymVerschieben('2026-01', -1), '2025-12');
  assert.equal(ymVerschieben('2026-12', 1), '2027-01');
  assert.equal(ymVerschieben('2026-05', -17), '2024-12');
  assert.equal(ymText('2026-03'), 'März 2026');
});

test('Euro-Formatierung und -Parsing in Cent', () => {
  assert.equal(euro(4200), '42,00 €');
  assert.equal(euro(123456), '1.234,56 €');
  assert.equal(euro(-5), '−0,05 €');
  assert.equal(parseEuro('8,9'), 890);
  assert.equal(parseEuro('12.34'), 1234);
  assert.equal(parseEuro(' 7 € '), 700);
  assert.equal(parseEuro(''), 0);
  assert.equal(parseEuro('abc'), null);
  assert.equal(parseEuro('1,234'), null);
});

test('Bestellnummer wird je Monat einmalig und fortlaufend je Jahr vergeben', () => {
  const d = standardDaten(JETZT);
  const a = neuerMonat(JETZT.toISOString()), b = neuerMonat(JETZT.toISOString()), c = neuerMonat(JETZT.toISOString());
  assert.equal(vergibBestellnr(d, '2026-09', a), 'BS-2026-001');
  assert.equal(vergibBestellnr(d, '2026-09', a), 'BS-2026-001');
  assert.equal(vergibBestellnr(d, '2026-10', b), 'BS-2026-002');
  assert.equal(vergibBestellnr(d, '2027-01', c), 'BS-2027-001');
});

test('Versiegeln/Entsiegeln protokolliert und behält Bestellnummer', () => {
  const d = standardDaten(JETZT);
  const m = neuerMonat(JETZT.toISOString());
  versiegle(d, '2026-09', m, { name: 'A. Muster', sig: SIG, zeit: JETZT.toISOString() });
  assert.equal(m.status, 'versiegelt');
  assert.equal(m.bestellnr, 'BS-2026-001');
  entsiegle(m, JETZT.toISOString());
  assert.equal(m.status, 'entwurf');
  assert.equal(m.siegel, null);
  assert.equal(m.bestellnr, 'BS-2026-001');
  assert.equal(m.protokoll.length, 2);
  versiegle(d, '2026-09', m, { name: 'B', sig: SIG, zeit: JETZT.toISOString() });
  assert.equal(m.bestellnr, 'BS-2026-001');
});

test('Summen und Budget § 40 Abs. 2 SGB XI (Inko nicht angerechnet)', () => {
  const d = standardDaten(JETZT);
  d.einstellungen.preiseCent.hm = 890;
  d.einstellungen.preiseCent.dh = 1250;
  const z1 = { ...leereZeile('a'), name: 'Frau A', hm: 3, dh: true, inko: 'Pants M' };
  const z2 = { ...leereZeile('b'), name: 'Herr B', hm: 1 };
  const s = summen([z1, z2, leereZeile('c')]);
  assert.equal(s.personen, 2);
  assert.equal(s.hm, 4);
  assert.equal(s.dh, 1);
  assert.equal(s.inko, 1);
  const b = budgetZeile(z1, d.einstellungen);
  assert.equal(b.kostenCent, 3 * 890 + 1250);
  assert.equal(b.ueberschritten, false);
  const teuer = budgetZeile({ ...z1, hm: 5 }, d.einstellungen);
  assert.equal(teuer.kostenCent, 5700);
  assert.equal(teuer.ueberschritten, true);
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
    einstellungen: { budgetCent: -5, preiseCent: { hs: '120', xx: 5 }, absender: { name: 42 } },
    monate: {
      '2026-13': { zeilen: [{ name: 'x' }] },
      '2026-09': {
        status: 'versiegelt', siegel: { name: 'x', sig: 'javascript:alert(1)', zeit: '' },
        zeilen: [{ id: 'a', name: 'A', hs: 99, wh: 'ja' }, { id: 'a', name: 'B' }, {}], bestellnr: 'kaputt'
      }
    },
    zaehler: { '2026': 3, abc: 1 }, aktuellerMonat: 'x'
  }, JETZT);
  assert.equal(d.einstellungen.budgetCent, 0);
  assert.equal(d.einstellungen.preiseCent.hs, 120);
  assert.equal(d.einstellungen.absender.name, '');
  assert.deepEqual(Object.keys(d.monate), ['2026-09']);
  const m = d.monate['2026-09'];
  assert.equal(m.status, 'entwurf', 'Versiegelung ohne gültige Signatur wird nicht übernommen');
  assert.equal(m.siegel, null);
  assert.equal(m.bestellnr, null);
  assert.equal(m.zeilen.length, 2, 'leere Zeile entfernt');
  assert.equal(m.zeilen[0].hs, 5);
  assert.equal(m.zeilen[0].wh, false);
  assert.notEqual(m.zeilen[0].id, m.zeilen[1].id, 'doppelte IDs werden aufgelöst');
  assert.deepEqual(d.zaehler, { '2026': 3 });
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
