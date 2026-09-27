// Minimaler statischer Server für lokale Tests (nur Lesen innerhalb des App-Ordners).
// Cache-Header wie GitHub Pages (max-age=600), damit Update-Probleme durch HTTP-Caching auffallen.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = fileURLToPath(new URL('..', import.meta.url));
const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

export function starteServer(port) {
  const server = createServer(async (req, res) => {
    const pfad = decodeURIComponent(new URL(req.url || '/', 'http://x').pathname);
    const datei = normalize(join(WURZEL, pfad.endsWith('/') ? pfad + 'index.html' : pfad));
    if (!datei.startsWith(WURZEL) || datei.includes(sep + 'node_modules' + sep)) { res.writeHead(403).end(); return; }
    try {
      const inhalt = await readFile(datei);
      res.writeHead(200, { 'Content-Type': TYPEN[extname(datei)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' });
      res.end(inhalt);
    } catch (_) {
      res.writeHead(404).end('Nicht gefunden');
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8080);
  await starteServer(port);
  console.log('PflegeBox: http://127.0.0.1:' + port + '/');
}
