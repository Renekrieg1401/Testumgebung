// End-to-End-Test im echten Chromium: Migration, Eingabe, Verschlüsselung, Budget, PDF/CSV, Versiegeln,
// Monatsübernahme, Sperre/Entsperren, Offline-Start über den Service Worker, keine Konsolen-/CSP-Fehler.
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
const page = await context.newPage();
const fehler = [];
page.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });
page.on('pageerror', (e) => fehler.push(String(e)));

const schritt = (t) => console.log('✓ ' + t);
const pin = async (a, b) => {
  await page.fill('#gate-pin', a);
  if (b !== undefined) await page.fill('#gate-pin2', b);
  await page.click('#gate-los');
};
const zeile = (n) => page.locator('#tabelle tbody tr').nth(n);

try {
  // 1) Altbestand (Klartext, v1) vorbereiten → Migrationsmodus
  await page.goto(URL_APP);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('bestellschein_aktuell', JSON.stringify({ monat: 'September', 'name-0': 'Frau Altbestand', 'm-0': '2', 'wh-0': true }));
  });
  await page.reload();
  await page.waitForSelector('#gate:not([hidden])');
  assert.match(await page.textContent('#gate-hinweis'), /Sicherheits-Update/);
  assert.equal(await page.getAttribute('#haupt', 'aria-hidden'), 'true');
  await pin('123456', '654321');
  assert.match(await page.textContent('#gate-fehler'), /stimmen nicht/);
  await pin('1234', '1234');
  assert.match(await page.textContent('#gate-fehler'), /6–8 Ziffern/);
  await pin('246810', '246810');
  await page.waitForSelector('#gate', { state: 'hidden' });
  assert.equal(await zeile(0).locator('[data-feld="name"]').inputValue(), 'Frau Altbestand');
  assert.equal(await zeile(0).locator('[data-feld="hm"]').inputValue(), '2');
  assert.equal(await page.evaluate(() => localStorage.getItem('bestellschein_aktuell')), null);
  schritt('Migration Klartext → verschlüsselt');

  // 2) Eingabe mit automatischer Leerzeile
  await zeile(1).locator('[data-feld="name"]').fill('Herr Neu');
  await zeile(1).locator('[data-feld="hs"]').selectOption('3');
  await zeile(1).locator('[data-feld="dh"]').check();
  await zeile(1).locator('[data-feld="inko"]').fill('Pants Gr. L');
  assert.equal(await page.locator('#tabelle tbody tr').count(), 3);
  assert.match(await page.textContent('#tabelle tfoot'), /Summe \(2 Pers\.\)/);
  await page.waitForFunction(() => document.getElementById('speicher-text')?.textContent === 'Verschlüsselt gespeichert');
  const roh = await page.evaluate(() => JSON.stringify(localStorage));
  assert.ok(!roh.includes('Herr Neu') && !roh.includes('Altbestand') && !roh.includes('Pants'), 'Klartext im Speicher!');
  schritt('Eingabe, Summen, verschlüsselte Persistenz');

  // 3) Einstellungen: Absender, Lieferant, Preise → Budgetampel
  await page.click('#btn-einstellungen');
  await page.fill('#abs-name', 'Pflegedienst Sonnenschein');
  await page.fill('#lief-name', 'Sanitätshaus Müller');
  await page.fill('#preis-hs', 'abc');
  await page.click('#einstellungen-form button[value="speichern"]');
  assert.match(await page.textContent('#einstellungen-fehler'), /Format/);
  await page.fill('#preis-hs', '8,90');
  await page.fill('#preis-dh', '25');
  await page.click('#einstellungen-form button[value="speichern"]');
  await page.waitForSelector('#dlg-einstellungen', { state: 'hidden' });
  const budget = await zeile(1).locator('.sp-budget').textContent();
  assert.match(budget, /51,70 €/);
  assert.match(budget, /⚠/);
  assert.ok(await zeile(1).locator('.sp-budget.budget-ueber').count());
  schritt('Einstellungen + Budgetprüfung § 40 Abs. 2 SGB XI');

  // 4) PDF + CSV (Headless: kein navigator.share → Download-Fallback)
  let dl = page.waitForEvent('download');
  await page.click('#btn-pdf');
  let datei = await dl;
  const pdfPfad = new URL('bestellung.pdf', AUSGABE).pathname;
  await datei.saveAs(pdfPfad);
  assert.equal(readFileSync(pdfPfad).subarray(0, 5).toString(), '%PDF-');
  assert.match(datei.suggestedFilename(), /^Bestellung_\d{4}-\d{2}_Entwurf\.pdf$/);
  dl = page.waitForEvent('download');
  await page.click('#btn-csv');
  datei = await dl;
  const csvPfad = new URL('bestellung.csv', AUSGABE).pathname;
  await datei.saveAs(csvPfad);
  const csv = readFileSync(csvPfad, 'utf8');
  assert.ok(csv.includes('"Herr Neu"') && csv.includes('"51,70 €"'));
  schritt('PDF- und CSV-Export');

  // 5) Versiegeln mit Unterschrift
  await page.click('#btn-versiegeln');
  await page.click('#signatur-form button[value="versiegeln"]');
  assert.match(await page.textContent('#signatur-fehler'), /Namen/);
  await page.fill('#signatur-name', 'Anna Muster');
  const box = await page.locator('#signatur-canvas').boundingBox();
  await page.mouse.move(box.x + 20, box.y + 100);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 20 + i * 25, box.y + 100 + (i % 2 ? -40 : 40));
  await page.mouse.up();
  await page.click('#signatur-form button[value="versiegeln"]');
  await page.waitForSelector('#dlg-signatur', { state: 'hidden' });
  assert.equal(await page.textContent('#status-badge'), 'Versiegelt');
  assert.match(await page.textContent('#bestellnr'), /BS-\d{4}-001/);
  assert.ok(await zeile(0).locator('[data-feld="name"]').isDisabled());
  assert.equal(await page.locator('#tabelle tbody tr').count(), 2, 'keine Leerzeile im versiegelten Monat');
  dl = page.waitForEvent('download');
  await page.click('#btn-pdf');
  datei = await dl;
  assert.match(datei.suggestedFilename(), /BS-\d{4}-001\.pdf$/);
  await datei.saveAs(new URL('bestellung-versiegelt.pdf', AUSGABE).pathname);
  schritt('Versiegeln mit Unterschrift, Bestell-Nr., Schreibschutz');

  // 6) Folgemonat: Übernahme aus Vormonat
  await page.click('#monat-vor');
  await page.waitForSelector('#uebernahme:not([hidden])');
  await page.click('#btn-uebernehmen-namen');
  assert.equal(await zeile(0).locator('[data-feld="name"]').inputValue(), 'Frau Altbestand');
  assert.equal(await zeile(1).locator('[data-feld="hs"]').inputValue(), '0');
  assert.equal(await page.textContent('#status-badge'), 'Entwurf');
  schritt('Monatswechsel + Übernahme Personen');

  // 7) Mobile Darstellung (Karten) + Screenshots
  await page.screenshot({ path: new URL('desktop.png', AUSGABE).pathname, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: new URL('mobil.png', AUSGABE).pathname, fullPage: true });
  const breite = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(breite <= 390, 'horizontaler Scroll auf Mobil: ' + breite);
  await page.setViewportSize({ width: 1280, height: 900 });
  schritt('Responsive Kartenansicht ohne horizontales Scrollen');

  // 8) Sperre + Neustart: falsche/richtige PIN, Daten bleiben erhalten
  await page.waitForFunction(() => document.getElementById('speicher-text')?.textContent === 'Verschlüsselt gespeichert');
  await page.click('#btn-sperren');
  await page.waitForSelector('#gate:not([hidden])');
  assert.equal(await page.locator('#tabelle tbody tr').count(), 0, 'Tabelle bei Sperre geleert');
  await pin('246810');
  await page.waitForSelector('#gate', { state: 'hidden' });
  await page.reload();
  await page.waitForSelector('#gate:not([hidden])');
  await pin('111111');
  await page.waitForFunction(() => /Falsche PIN/.test(document.getElementById('gate-fehler')?.textContent || ''));
  await pin('246810');
  await page.waitForSelector('#gate', { state: 'hidden' });
  await page.click('#monat-zurueck');
  assert.equal(await page.textContent('#status-badge'), 'Versiegelt');
  assert.equal(await zeile(1).locator('[data-feld="name"]').inputValue(), 'Herr Neu');
  schritt('Sperre, Neustart, PIN-Prüfung, Persistenz');

  // 9) Offline-Start über Service Worker
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('#gate:not([hidden])');
  await pin('246810');
  await page.waitForSelector('#gate', { state: 'hidden' });
  assert.ok(await page.locator('#tabelle tbody tr').count() > 0);
  await context.setOffline(false);
  schritt('Offline-Start (Service Worker)');

  const relevant = fehler.filter((f) => !/Failed to load resource.*ERR_INTERNET_DISCONNECTED/.test(f));
  assert.deepEqual(relevant, [], 'Konsolenfehler: ' + relevant.join('\n'));
  schritt('keine Konsolen-/CSP-Fehler');
  console.log('E2E erfolgreich.');
} finally {
  await browser.close();
  server.close();
}
