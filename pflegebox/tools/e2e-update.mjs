// Update-Test unter GitHub-Pages-Bedingungen (Cache-Control: max-age=600): App offen, neue Version wird
// veröffentlicht, Overlay „Jetzt aktualisieren“ → danach muss der NEUE Programmcode aktiv sein, nicht nur
// die neue index.html (Regressionstest: fehlende PDF-Legende nach Update).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { starteBrowser } from './browser.mjs';

const QUELLE = fileURLToPath(new URL('..', import.meta.url));
const ORDNER = mkdtempSync(join(tmpdir(), 'pflegebox-update-'));
const PORT = 8799;
const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

cpSync(QUELLE, ORDNER, { recursive: true, filter: (p) => !/node_modules|[\\/]dist|[\\/]tests/.test(p.slice(QUELLE.length)) });
const server = createServer((req, res) => {
  const pfad = new URL(req.url || '/', 'http://x').pathname;
  const datei = join(ORDNER, pfad.endsWith('/') ? pfad + 'index.html' : pfad);
  try {
    const inhalt = readFileSync(datei);
    res.writeHead(200, { 'Content-Type': TYPEN[extname(datei)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' });
    res.end(inhalt);
  } catch (_) {
    res.writeHead(404).end();
  }
}).listen(PORT, '127.0.0.1');

/** @param {string} rel @param {string} alt @param {string} neu */
const ersetze = (rel, alt, neu) => {
  const f = join(ORDNER, rel);
  const s = readFileSync(f, 'utf8');
  assert.ok(s.includes(alt), rel + ' enthält ' + alt + ' nicht');
  writeFileSync(f, s.replace(alt, neu));
};

const browser = await starteBrowser();
try {
  const page = await (await browser.newContext()).newPage();
  const platzhalter = () => page.getAttribute('#tabelle tbody tr [data-feld="name"]', 'placeholder');
  await page.goto('http://127.0.0.1:' + PORT + '/index.html');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  assert.equal(await platzhalter(), 'Name eintragen …');

  ersetze('index.html', /content="(\d{4}-[^"]+)"/.exec(readFileSync(join(ORDNER, 'index.html'), 'utf8'))?.[0] || '', 'content="2099-01-01-001"');
  ersetze('js/tabelle.js', "'Name eintragen …'", "'NEUE VERSION'");

  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForSelector('#update-banner:not([hidden])', { timeout: 10000 });
  await Promise.all([page.waitForEvent('load'), page.click('#update-laden')]);
  await page.waitForTimeout(500);
  assert.equal(await page.getAttribute('meta[name="app-version"]', 'content'), '2099-01-01-001');
  assert.equal(await platzhalter(), 'NEUE VERSION', 'nach dem Update läuft noch alter Programmcode');
  assert.equal(await page.isVisible('#update-banner'), false);
  console.log('✓ Update unter HTTP-Caching (max-age=600): neuer Programmcode aktiv');
} finally {
  await browser.close();
  server.close();
  rmSync(ORDNER, { recursive: true, force: true });
}
