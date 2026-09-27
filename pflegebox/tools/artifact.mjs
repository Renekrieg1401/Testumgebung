// Baut eine eigenständige Einzeldatei (CSS + gebündeltes JS eingebettet) für die Veröffentlichung als
// claude.ai-Artifact: dist/pflegebox.html. Die reguläre PWA (index.html + Module) bleibt unverändert.
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const wurzel = new URL('..', import.meta.url);
const html = readFileSync(new URL('index.html', wurzel), 'utf8');
const css = readFileSync(new URL('app.css', wurzel), 'utf8');
const koerper = /<body>([\s\S]*)<\/body>/.exec(html);
if (!koerper) throw new Error('index.html ohne <body>');
const titel = /<title>([^<]*)<\/title>/.exec(html);

const js = await build({
  entryPoints: [new URL('js/app.js', wurzel).pathname],
  bundle: true, format: 'iife', minify: true, write: false, target: 'es2020'
});
const skript = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const seite = '<title>' + (titel ? titel[1].split(' — ')[0] : 'PflegeBox') + '</title>\n' +
  '<meta name="app-version" content="' + (/name="app-version" content="([^"]+)"/.exec(html) || ['', ''])[1] + '">\n' +
  '<style>\n' + css + '\n</style>\n' + koerper[1].trim() + '\n<script>\n' + skript + '</script>\n';
mkdirSync(new URL('dist/', wurzel), { recursive: true });
writeFileSync(new URL('dist/pflegebox.html', wurzel), seite);
console.log('dist/pflegebox.html: ' + Math.round(seite.length / 1024) + ' KB');
