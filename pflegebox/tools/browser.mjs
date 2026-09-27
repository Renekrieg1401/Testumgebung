// Gemeinsamer Chromium-Start für Werkzeuge/E2E (vorinstallierter Browser, kein Download).
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function chromiumPfad() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const basis = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const direkt = join(basis, 'chromium');
  if (existsSync(direkt) && !readdirSync(basis).some((d) => d.startsWith('chromium-'))) return direkt;
  const ordner = readdirSync(basis).filter((d) => d.startsWith('chromium-')).sort().pop();
  if (!ordner) throw new Error('Kein Chromium unter ' + basis + ' gefunden (CHROMIUM_PATH setzen).');
  const kandidaten = ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'];
  const treffer = kandidaten.map((k) => join(basis, ordner, k)).find((p) => existsSync(p));
  if (!treffer) throw new Error('Chromium-Binary in ' + ordner + ' nicht gefunden.');
  return treffer;
}

export function starteBrowser() {
  return chromium.launch({ executablePath: chromiumPfad() });
}
