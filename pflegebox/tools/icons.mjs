// Erzeugt die PNG-Icons aus icons/icon.svg (PWA-Manifest, iOS apple-touch-icon ohne Transparenz).
import { readFileSync, writeFileSync } from 'node:fs';
import { starteBrowser } from './browser.mjs';

const svg = readFileSync(new URL('../icons/icon.svg', import.meta.url), 'utf8');
const vollflaechig = svg.replace('rx="90"', 'rx="0"');
const ziele = [
  { datei: 'icon-192.png', groesse: 192, quelle: svg },
  { datei: 'icon-512.png', groesse: 512, quelle: svg },
  { datei: 'apple-touch-icon.png', groesse: 180, quelle: vollflaechig }
];

const browser = await starteBrowser();
const page = await browser.newPage();
for (const z of ziele) {
  await page.setViewportSize({ width: z.groesse, height: z.groesse });
  await page.setContent('<html><body style="margin:0;background:transparent">' +
    z.quelle.replace('<svg ', '<svg width="' + z.groesse + '" height="' + z.groesse + '" ') + '</body></html>');
  writeFileSync(new URL('../icons/' + z.datei, import.meta.url), await page.screenshot({ omitBackground: true }));
}
await browser.close();
