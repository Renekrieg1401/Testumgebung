import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fuehreZusammen } from '../js/spiegel.js';
import { leereZeile, neuerMonat, standardDaten } from '../js/model.js';

const JETZT = new Date('2026-09-27T10:00:00Z');
const snap = (id, inhalt, zeit) => ({ id, data: () => ({ json: JSON.stringify(inhalt), zeit }) });

test('Abgleich: jüngerer Stand gewinnt je Monat, lokal Neueres wird hochgeladen', () => {
  const d = standardDaten(JETZT);
  const alt = neuerMonat('2026-09-01T00:00:00Z'); alt.zeilen.push({ ...leereZeile('a'), name: 'Lokal alt' });
  const neu = neuerMonat('2026-10-05T00:00:00Z'); neu.zeilen.push({ ...leereZeile('b'), name: 'Lokal neu' });
  const nurLokal = neuerMonat('2026-11-01T00:00:00Z'); nurLokal.zeilen.push({ ...leereZeile('c'), name: 'Nur lokal' });
  d.monate['2026-09'] = alt; d.monate['2026-10'] = neu; d.monate['2026-11'] = nurLokal;
  const fern09 = { ...neuerMonat('2026-09-20T00:00:00Z'), zeilen: [{ ...leereZeile('x'), name: 'Konto neu', hs: 2 }] };
  const fern10 = { ...neuerMonat('2026-10-01T00:00:00Z'), zeilen: [{ ...leereZeile('y'), name: 'Konto alt' }] };
  const fern08 = { ...neuerMonat('2026-08-01T00:00:00Z'), zeilen: [{ ...leereZeile('z'), name: 'Nur Konto' }] };
  const erg = fuehreZusammen(d, [
    snap('monat-2026-09', fern09, '2026-09-20T00:00:00Z'),
    snap('monat-2026-10', fern10, '2026-10-01T00:00:00Z'),
    snap('monat-2026-08', fern08, '2026-08-01T00:00:00Z'),
    snap('einstellungen', { absender: { name: 'Konto-Dienst' } }, '2026-09-01T00:00:00Z'),
    snap('fremd', {}, 'x'), { id: 'monat-2026-07', data: () => ({ json: '{kaputt', zeit: 'z' }) }
  ], JETZT);
  assert.equal(erg.geaendert, true);
  assert.equal(d.monate['2026-09'].zeilen[0].name, 'Konto neu');
  assert.equal(d.monate['2026-09'].zeilen[0].hs, 2);
  assert.equal(d.monate['2026-10'].zeilen[0].name, 'Lokal neu');
  assert.equal(d.monate['2026-08'].zeilen[0].name, 'Nur Konto');
  assert.equal(d.monate['2026-07'], undefined);
  assert.equal(d.einstellungen.absender.name, 'Konto-Dienst');
  assert.deepEqual(erg.lokalNeuer.sort(), ['2026-10', '2026-11']);
});

test('Abgleich ohne entfernte Daten lädt alles Lokale hoch', () => {
  const d = standardDaten(JETZT);
  d.monate['2026-09'] = neuerMonat(JETZT.toISOString());
  d.einstellungenGeaendert = JETZT.toISOString();
  const erg = fuehreZusammen(d, [], JETZT);
  assert.equal(erg.geaendert, false);
  assert.deepEqual(erg.lokalNeuer.sort(), ['2026-09', 'einstellungen']);
});
