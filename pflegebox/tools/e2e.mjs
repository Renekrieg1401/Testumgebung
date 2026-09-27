// End-to-End-Test im echten Chromium: Migration, Eingabe, Persistenz, PDF/JPG,
// Zeile leeren, Schließen direkt nach Eingabe, Update-Overlay, Monatsübernahme, Offline-Start über den Service Worker, keine Konsolen-/CSP-Fehler.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { starteServer } from './server.mjs';
import { starteBrowser } from './browser.mjs';

const PORT = 8765;
const URL_APP = 'http://127.0.0.1:' + PORT + '/index.html';
const AUSGABE = new URL('../tests/.ausgabe/', import.meta.url);
mkdirSync(AUSGABE, { recursive: true });

const server = await starteServer(PORT);
const browser = await starteBrowser();
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 }, locale: 'de-DE' });
const fehler = [];
const neueSeite = async () => {
  const p = await context.newPage();
  p.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });
  p.on('pageerror', (e) => fehler.push(String(e)));
  return p;
};
let page = await neueSeite();

const schritt = (t) => console.log('✓ ' + t);
const zeile = (n) => page.locator('#tabelle tbody tr').nth(n);

try {
  // 1) Altbestand (Klartext, v1) vorbereiten → Migrationsmodus
  await page.goto(URL_APP);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('bestellschein_aktuell', JSON.stringify({ monat: 'September', 'name-0': 'Frau Altbestand', 'm-0': '2', 'wh-0': true }));
  });
  await page.reload();
  assert.equal(await zeile(0).locator('[data-feld="name"]').inputValue(), 'Frau Altbestand');
  assert.equal(await zeile(0).locator('[data-feld="hm"]').inputValue(), '2');
  assert.equal(await page.evaluate(() => localStorage.getItem('bestellschein_aktuell')), null);
  schritt('Übernahme des bisherigen Bestellscheins ohne Anmeldung');

  // 2) Weitere Person per „+“, leere Kachel per „−“ wieder weg, dann Eingabe
  assert.equal(await page.locator('#tabelle tbody tr[data-id]').count(), 1);
  await page.click('#btn-person-neu');
  await page.click('#btn-person-neu');
  assert.equal(await page.locator('#tabelle tbody tr[data-id]').count(), 3);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-feld')), 'name');
  await zeile(2).locator('[data-aktion="entfernen"]').click();
  assert.equal(await page.locator('#tabelle tbody tr[data-id]').count(), 2);
  await zeile(1).locator('[data-feld="name"]').fill('Herr Neu');
  await zeile(1).locator('[data-feld="hs"]').selectOption('3');
  await zeile(1).locator('[data-feld="dh"]').check();
  await zeile(1).locator('[data-feld="inko"]').fill('Pants Gr. L');
  assert.equal(await page.locator('#tabelle tbody tr[data-id]').count(), 2);
  assert.match(await page.textContent('#tabelle tfoot'), /Summe \(2 Pers\.\)/);
  await page.waitForFunction(() => document.getElementById('speicher-text')?.textContent === 'Gespeichert');
  schritt('„+“ neue Person, „−“ leere Kachel entfernen, Eingabe, Summen, Speichern');

  // 3) Keine Einstellungen mehr in der Oberfläche
  assert.equal(await page.locator('#btn-einstellungen').count(), 0);
  schritt('Keine Einstellungs-Option');

  // 4) PDF/JPG (Headless: kein navigator.share → Download-Fallback, Abschluss unbekannt → Rückfrage)
  const personen = () => page.locator('#tabelle tbody tr[data-id]:not([data-id=""])').count();
  const behalten = async () => { await page.waitForSelector('#dlg-bestaetigen[open]'); await page.click('#dlg-bestaetigen-abbrechen'); };
  const dl = page.waitForEvent('download');
  await page.click('#btn-pdf');
  const datei = await dl;
  const pdfPfad = new URL('bestellung.pdf', AUSGABE).pathname;
  await datei.saveAs(pdfPfad);
  assert.equal(readFileSync(pdfPfad).subarray(0, 5).toString(), '%PDF-');
  assert.match(datei.suggestedFilename(), /^Bestellung_\d{4}-\d{2}\.pdf$/);
  assert.match(await page.textContent('#dlg-bestaetigen-titel'), /Download abgeschlossen/);
  await behalten();
  assert.equal(await personen(), 2, '„Nein, behalten“ darf nichts zurücksetzen');
  const dlJpg = page.waitForEvent('download');
  await page.click('#btn-jpg-laden');
  const jpg = await dlJpg;
  const jpgPfad = new URL('bestellung.jpg', AUSGABE).pathname;
  await jpg.saveAs(jpgPfad);
  const jpgBytes = readFileSync(jpgPfad);
  assert.equal(jpgBytes[0], 0xff);
  assert.equal(jpgBytes[1], 0xd8);
  assert.match(jpg.suggestedFilename(), /^Bestellung_\d{4}-\d{2}\.jpg$/);
  await behalten();
  const dlPdf2 = page.waitForEvent('download');
  await page.click('#btn-pdf-laden');
  assert.match((await dlPdf2).suggestedFilename(), /\.pdf$/);
  await page.waitForSelector('#dlg-bestaetigen[open]');
  await page.click('#dlg-bestaetigen-ok');
  await page.waitForSelector('#gesendet-hinweis:not([hidden])');
  assert.equal(await personen(), 0, 'nach bestätigtem Download zurückgesetzt');
  await page.reload();
  await page.waitForSelector('#gesendet-hinweis:not([hidden])');
  assert.equal(await personen(), 0, 'Zurücksetzen bleibt nach Neustart bestehen');
  await page.click('#btn-wiederherstellen');
  assert.equal(await personen(), 2);
  assert.equal(await zeile(1).locator('[data-feld="name"]').inputValue(), 'Herr Neu');
  schritt('Download: Rückfrage, „Nein“ behält, „Ja“ setzt zurück, Wiederherstellen');

  // 4b) Teilen: abgebrochen → nichts passiert; erfolgreich → sofort zurückgesetzt (ohne Rückfrage)
  await page.evaluate(() => {
    const nav = /** @type {any} */ (navigator);
    nav.canShare = () => true;
    nav.share = () => (window.__teilenAbbruch ? Promise.reject(new DOMException('abgebrochen', 'AbortError')) : Promise.resolve());
    window.__teilenAbbruch = true;
  });
  await page.click('#btn-jpg');
  await page.waitForTimeout(300);
  assert.equal(await personen(), 2, 'abgebrochenes Teilen darf nichts zurücksetzen');
  assert.equal(await page.locator('#dlg-bestaetigen[open]').count(), 0);
  await page.evaluate(() => { window.__teilenAbbruch = false; });
  await page.click('#btn-pdf');
  await page.waitForSelector('#gesendet-hinweis:not([hidden])');
  assert.equal(await personen(), 0);
  assert.match(await page.textContent('#gesendet-text'), /als PDF/);
  await page.click('#btn-wiederherstellen');
  assert.equal(await personen(), 2);
  await page.reload();
  schritt('Teilen: Abbruch behält, Erfolg setzt zurück, Wiederherstellen');

  // 5) Folgemonat: Übernahme aus Vormonat
  await page.click('#monat-vor');
  await page.waitForSelector('#uebernahme:not([hidden])');
  await page.click('#btn-uebernehmen-namen');
  assert.equal(await zeile(0).locator('[data-feld="name"]').inputValue(), 'Frau Altbestand');
  assert.equal(await zeile(1).locator('[data-feld="hs"]').inputValue(), '0');
  schritt('Monatswechsel + Übernahme Personen');

  // 5b) Einzelne Zeile leeren (mit Rückfrage)
  await zeile(0).locator('[data-aktion="entfernen"]').click();
  await page.click('#dlg-bestaetigen-abbrechen');
  assert.equal(await zeile(0).locator('[data-feld="name"]').inputValue(), 'Frau Altbestand');
  await zeile(0).locator('[data-aktion="entfernen"]').click();
  assert.match(await page.textContent('#dlg-bestaetigen-text'), /Frau Altbestand/);
  await page.click('#dlg-bestaetigen-ok');
  await page.waitForFunction(() => /Summe \(1 Pers\.\)/.test(document.querySelector('#tabelle tfoot')?.textContent || ''));
  assert.equal(await zeile(0).locator('[data-feld="name"]').inputValue(), 'Herr Neu');
  schritt('Person per „−“ mit Rückfrage entfernen');

  // 6) Mobile Darstellung (Karten) + Screenshots
  await page.screenshot({ path: new URL('desktop.png', AUSGABE).pathname, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: new URL('mobil.png', AUSGABE).pathname, fullPage: true });
  const breite = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(breite <= 390, 'horizontaler Scroll auf Mobil: ' + breite);
  await page.setViewportSize({ width: 1280, height: 900 });
  schritt('Responsive Kartenansicht ohne horizontales Scrollen');

  // 7) App schließen direkt nach der Eingabe (ohne Wartezeit) → Eingabe bleibt erhalten
  await page.click('#monat-zurueck');
  await zeile(0).locator('[data-feld="inko"]').fill('Sofort gespeichert');
  await page.close();
  page = await neueSeite();
  await page.goto(URL_APP);
  assert.equal(await zeile(0).locator('[data-feld="inko"]').inputValue(), 'Sofort gespeichert');
  assert.equal(await zeile(1).locator('[data-feld="name"]').inputValue(), 'Herr Neu');
  assert.equal(await zeile(1).locator('[data-feld="hs"]').inputValue(), '3');
  schritt('Schließen direkt nach Eingabe, Neustart, Persistenz');

  // 8) Offline-Start über Service Worker
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  assert.ok(await page.locator('#tabelle tbody tr').count() > 0);
  await context.setOffline(false);
  schritt('Offline-Start (Service Worker)');

  // 9) Neue Version veröffentlicht → Overlay beim Öffnen
  const neueVersion = async (route) => {
    const res = await route.fetch();
    const html = (await res.text()).replace(/name="app-version" content="[^"]+"/, 'name="app-version" content="9999-99-99-999"');
    await route.fulfill({ response: res, body: html });
  };
  await context.route(/index\.html\?v=/, neueVersion);
  await page.reload();
  await page.waitForSelector('#update-banner:not([hidden])');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'update-laden');
  await context.unroute(/index\.html\?v=/, neueVersion);
  await page.click('#update-laden');
  await page.waitForLoadState('load');
  await page.waitForTimeout(500);
  assert.equal(await page.isHidden('#update-banner'), true);
  assert.equal(await zeile(0).locator('[data-feld="inko"]').inputValue(), 'Sofort gespeichert');
  schritt('Update-Overlay beim Öffnen, Daten bleiben nach Aktualisierung');

  const relevant = fehler.filter((f) => !/Failed to load resource.*ERR_INTERNET_DISCONNECTED/.test(f));
  assert.deepEqual(relevant, [], 'Konsolenfehler: ' + relevant.join('\n'));
  schritt('keine Konsolen-/CSP-Fehler');
  console.log('E2E erfolgreich.');
} finally {
  await browser.close();
  server.close();
}
