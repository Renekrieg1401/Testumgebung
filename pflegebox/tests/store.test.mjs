import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erzeugeTresor, erkenneModus, KEY_ALT, KEY_ENC, pinGueltig } from '../js/store.js';

function speicher() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, m };
}
const env = { subtle: globalThis.crypto.subtle, zufall: (a) => globalThis.crypto.getRandomValues(a), jetzt: () => new Date('2026-09-27T10:00:00Z') };

test('PIN-Regel: 6–8 Ziffern', () => {
  assert.equal(pinGueltig('12345'), false);
  assert.equal(pinGueltig('123456'), true);
  assert.equal(pinGueltig('12345678'), true);
  assert.equal(pinGueltig('12a456'), false);
});

test('Einrichtung, Speichern, Entsperren, falsche PIN — kein Klartext im Speicher', async () => {
  const s = speicher();
  assert.equal(erkenneModus(s), 'setup');
  const t = erzeugeTresor(s, env);
  assert.deepEqual(await t.richteEin('246810', false), { ok: true });
  assert.equal(erkenneModus(s), 'unlock');
  t.daten.einstellungen.absender.name = 'Pflegedienst Geheim';
  t.daten.monate['2026-09'] = { zeilen: [{ id: 'a', name: 'Frau Vertraulich', hs: 1, hm: 0, hl: 0, wh: false, ul: false, dh: false, df: false, wph: false, wpf: false, inko: '' }], status: 'entwurf', bestellnr: null, siegel: null, protokoll: [], geaendert: '' };
  assert.deepEqual(await t.speichere(), { ok: true });
  const roh = s.getItem(KEY_ENC);
  assert.ok(!roh.includes('Vertraulich') && !roh.includes('Geheim'));
  const t2 = erzeugeTresor(s, env);
  assert.deepEqual(await t2.entsperre('000000'), { ok: false, grund: 'pin' });
  assert.equal(t2.entsperrt, false);
  assert.deepEqual(await t2.entsperre('246810'), { ok: true });
  assert.equal(t2.daten.monate['2026-09'].zeilen[0].name, 'Frau Vertraulich');
  assert.deepEqual(await t2.pruefePin('246810'), { ok: true });
  assert.deepEqual(await t2.pruefePin('135790'), { ok: false, grund: 'pin' });
});

test('Migration: Altbestand wird verschlüsselt übernommen und Klartext entfernt', async () => {
  const s = speicher();
  s.setItem(KEY_ALT, JSON.stringify({ monat: 'September', 'name-0': 'Herr Alt', 'm-0': '3' }));
  s.setItem('pflegebox_version', 'abc');
  assert.equal(erkenneModus(s), 'migrate');
  const t = erzeugeTresor(s, env);
  assert.deepEqual(await t.richteEin('112233', true), { ok: true });
  assert.equal(s.getItem(KEY_ALT), null);
  assert.equal(s.getItem('pflegebox_version'), null);
  assert.equal(t.daten.monate['2026-09'].zeilen[0].hm, 3);
  const t2 = erzeugeTresor(s, env);
  assert.deepEqual(await t2.entsperre('112233'), { ok: true });
  assert.equal(t2.daten.monate['2026-09'].zeilen[0].name, 'Herr Alt');
});

test('Migration bricht bei unlesbarem Altbestand ab, ohne etwas zu verändern', async () => {
  const s = speicher();
  s.setItem(KEY_ALT, '{kaputt');
  assert.equal(erkenneModus(s), 'setup');
  s.setItem(KEY_ALT, '"nur ein string"');
  const t = erzeugeTresor(s, env);
  assert.deepEqual(await t.richteEin('112233', true), { ok: false, grund: 'altbestand' });
  assert.equal(s.getItem(KEY_ENC), null);
  assert.equal(s.getItem(KEY_ALT), '"nur ein string"');
});

test('Speicherfehler wird gemeldet statt verschluckt', async () => {
  const s = speicher();
  const t = erzeugeTresor(s, env);
  await t.richteEin('246810', false);
  s.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.deepEqual(await t.speichere(), { ok: false, grund: 'speicher' });
});

test('Sicherung und Wiederherstellung mit PIN der Sicherung', async () => {
  const a = speicher();
  const t = erzeugeTresor(a, env);
  await t.richteEin('111111', false);
  t.daten.einstellungen.lieferant.name = 'Sanitätshaus X';
  await t.speichere();
  const datei = t.sicherung();
  assert.ok(datei && !datei.includes('Sanitätshaus'));
  const b = speicher();
  const t2 = erzeugeTresor(b, env);
  await t2.richteEin('222222', false);
  assert.deepEqual(await t2.stelleWiederHer(datei, '222222'), { ok: false, grund: 'pin' });
  assert.deepEqual(await t2.stelleWiederHer('{"x":1}', '111111'), { ok: false, grund: 'defekt' });
  assert.deepEqual(await t2.stelleWiederHer(datei, '111111'), { ok: true });
  assert.equal(t2.daten.einstellungen.lieferant.name, 'Sanitätshaus X');
  const t3 = erzeugeTresor(b, env);
  assert.deepEqual(await t3.entsperre('111111'), { ok: true });
});
