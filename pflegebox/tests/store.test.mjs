import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erzeugeSpeicher, KEY, KEY_ALT, KEY_ALT_VERSION } from '../js/store.js';

function lokal() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
}
const jetzt = () => new Date('2026-09-27T10:00:00Z');

test('Erststart, Speichern, erneutes Laden', () => {
  const s = lokal();
  const a = erzeugeSpeicher(s, jetzt);
  assert.equal(a.lade(), 'neu');
  a.daten.einstellungen.lieferant.name = 'Sanitätshaus X';
  assert.deepEqual(a.speichere(), { ok: true });
  const b = erzeugeSpeicher(s, jetzt);
  assert.equal(b.lade(), 'geladen');
  assert.equal(b.daten.einstellungen.lieferant.name, 'Sanitätshaus X');
});

test('Altbestand v1 wird automatisch übernommen und danach entfernt', () => {
  const s = lokal();
  s.setItem(KEY_ALT, JSON.stringify({ monat: 'September', 'name-0': 'Herr Alt', 'm-0': '3' }));
  s.setItem(KEY_ALT_VERSION, 'abc');
  const a = erzeugeSpeicher(s, jetzt);
  assert.equal(a.lade(), 'migriert');
  assert.equal(a.daten.monate['2026-09'].zeilen[0].hm, 3);
  assert.equal(s.getItem(KEY_ALT), null);
  assert.equal(s.getItem(KEY_ALT_VERSION), null);
  assert.ok(s.getItem(KEY));
});

test('Altbestand bleibt erhalten, wenn Speichern fehlschlägt', () => {
  const s = lokal();
  s.setItem(KEY_ALT, JSON.stringify({ monat: 'September', 'name-0': 'Herr Alt' }));
  s.setItem = () => { throw new Error('QuotaExceededError'); };
  const a = erzeugeSpeicher(s, jetzt);
  assert.equal(a.lade(), 'migriert');
  assert.ok(s.getItem(KEY_ALT));
  assert.deepEqual(a.speichere(), { ok: false, grund: 'speicher' });
});

test('Beschädigter Bestand führt zu leerem Start statt Absturz', () => {
  const s = lokal();
  s.setItem(KEY, '{kaputt');
  const a = erzeugeSpeicher(s, jetzt);
  assert.equal(a.lade(), 'neu');
  assert.deepEqual(a.daten.monate, {});
});
