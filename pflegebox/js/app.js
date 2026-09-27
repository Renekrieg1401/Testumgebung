// @ts-check
// Einstiegspunkt: Verdrahtung von Speicher, Tabelle, Monatsnavigation, PDF-/JPG-Export
// und Update-Mechanik. Fachlogik liegt in model.js, I/O in store.js/teilen.js.

import {
  istLeer, leereZeile, letzterBefuellterMonatVor, MAX_ZEILEN, neueId, neuerMonat,
  protokolliere, uebernehmeZeilen, ymAus, ymText, ymVerschieben
} from './model.js';
import { erzeugeSpeicher } from './store.js';
import { erzeugeSpiegel } from './spiegel.js';
import { erzeugeTabelle } from './tabelle.js';
import { dateiname, erzeugeBestellJpeg, erzeugeBestellPdf } from './bestellung.js';
import { erkenneDownloadDienst, herunterladen, teileOderLade } from './teilen.js';
import { $, bestaetige, toast } from './dialoge.js';
import { appVersion, registriereServiceWorker, starteUpdatePruefung } from './update.js';


/** @typedef {import('./model.js').Monat} Monat */

const speicher = erzeugeSpeicher(window.localStorage, () => new Date());
const spiegel = erzeugeSpiegel(() => speicher.daten, () => new Date());
const idGen = () => neueId(Math.random);

let ym = ymAus(new Date());
/** Anzeige-Monat; wird erst beim ersten Eintrag in den Datenbestand übernommen. @type {Monat} */
let monat = neuerMonat(new Date().toISOString());

// ---------- Speichern ----------

/** @param {'speichert'|'ok'|'fehler'|''} art @param {string} text */
function status(art, text) {
  $('speicher-punkt').className = 'punkt' + (art ? ' punkt-' + art : '');
  $('speicher-text').textContent = text;
}

/** Schreibt sofort (synchron) in den Gerätespeicher — beim Schließen der App geht keine Eingabe verloren. */
function speichern() {
  if (speicher.speichere().ok) { status('ok', 'Gespeichert'); return; }
  status('fehler', 'Nicht gespeichert!');
  toast('Speichern fehlgeschlagen — Gerätespeicher voll oder gesperrt (privater Modus?).', 'fehler');
}

function monatGeaendert() {
  monat.geaendert = new Date().toISOString();
  speichern();
  spiegel.markiere(ym);
}

function monatUebernehmen() {
  if (!speicher.daten.monate[ym]) speicher.daten.monate[ym] = monat;
}

// ---------- Darstellung ----------

const tabelle = erzeugeTabelle(/** @type {HTMLTableElement} */ ($('tabelle')), {
  neueZeile() {
    if (monat.zeilen.length >= MAX_ZEILEN) return null;
    monatUebernehmen();
    const z = leereZeile(idGen());
    monat.zeilen.push(z);
    return z;
  },
  limitErreicht() { toast('Maximal ' + MAX_ZEILEN + ' Personen pro Monat.', 'warn'); },
  zeileGeaendert() { monatGeaendert(); zeigeKopfzeile(); },
  zeileEntfernen(id) {
    const z = monat.zeilen.find((x) => x.id === id);
    if (!z) return;
    bestaetige({ titel: 'Person entfernen?', text: 'Alle Angaben' + (z.name.trim() ? ' für „' + z.name.trim() + '“' : ' dieser Person') +
      ' werden gelöscht.', ok: 'Entfernen', gefahr: true }).then((ja) => {
      if (!ja) return;
      monat.zeilen = monat.zeilen.filter((x) => x.id !== id);
      monatGeaendert();
      zeigeMonat();
      toast('Person entfernt', 'warn');
    });
  }
});

function zeigeKopfzeile() {
  const befuellt = monat.zeilen.some((z) => !istLeer(z));
  $('monat-label').textContent = ymText(ym);
  ['btn-pdf', 'btn-jpg', 'btn-pdf-laden', 'btn-jpg-laden', 'btn-leeren'].forEach((id) => { /** @type {HTMLButtonElement} */ ($(id)).disabled = !befuellt; });
}

function zeigeUebernahme() {
  const quelle = monat.zeilen.length === 0 ? letzterBefuellterMonatVor(speicher.daten, ym) : null;
  $('uebernahme').hidden = !quelle;
  if (quelle) $('uebernahme-text').textContent = 'Noch keine Einträge. Personen aus ' + ymText(quelle) + ' übernehmen?';
  $('uebernahme').dataset.quelle = quelle || '';
}

function zeigeProtokoll() {
  const liste = $('protokoll-liste');
  liste.replaceChildren(...monat.protokoll.slice().reverse().map((p) => {
    const li = document.createElement('li');
    li.textContent = new Date(p.zeit).toLocaleString('de-DE') + ' — ' + p.aktion;
    return li;
  }));
  $('protokoll').hidden = monat.protokoll.length === 0;
}

function zeigeMonat() {
  const vorhanden = speicher.daten.monate[ym];
  if (vorhanden) vorhanden.zeilen = vorhanden.zeilen.filter((z) => !istLeer(z));
  monat = vorhanden || neuerMonat(new Date().toISOString());
  tabelle.zeige(monat);
  zeigeKopfzeile();
  zeigeUebernahme();
  zeigeProtokoll();
}

/** @param {number} delta */
function wechsleMonat(delta) {
  ym = ymVerschieben(ym, delta);
  speicher.daten.aktuellerMonat = ym;
  zeigeMonat();
}

// ---------- Aktionen ----------

function pdfBlob() {
  return new Blob([erzeugeBestellPdf(speicher.daten, ym, monat, new Date())], { type: 'application/pdf' });
}

/** @param {import('./teilen.js').TeilErgebnis} r @param {string} art */
function meldeDownload(r, art) {
  if (r === 'geteilt') toast(art + ' geteilt ✓', 'ok');
  if (r === 'geladen') toast(art + ' gespeichert ✓', 'ok');
  if (r === 'fehler') toast(art + ' konnte nicht gespeichert werden.', 'fehler');
}

$('btn-pdf').addEventListener('click', () => {
  teileOderLade(pdfBlob(), dateiname(ym, 'pdf'), 'Bestellung Pflegehilfsmittel ' + ymText(ym)).then((r) => meldeDownload(r, 'PDF'));
});

$('btn-pdf-laden').addEventListener('click', () => {
  herunterladen(pdfBlob(), dateiname(ym, 'pdf')).then((r) => meldeDownload(r, 'PDF'));
});

/** Erzeugt das JPG synchron (Teilen bleibt im Klick-Gesten-Kontext). @returns {Blob|null} */
function jpgBlob() {
  try {
    return new Blob([erzeugeBestellJpeg(speicher.daten, ym, monat, new Date())], { type: 'image/jpeg' });
  } catch (err) {
    toast('JPG konnte nicht erstellt werden: ' + (err instanceof Error ? err.message : String(err)), 'fehler');
    return null;
  }
}

$('btn-jpg').addEventListener('click', () => {
  const jpg = jpgBlob();
  if (jpg) teileOderLade(jpg, dateiname(ym, 'jpg'), 'Bestellung Pflegehilfsmittel ' + ymText(ym)).then((r) => meldeDownload(r, 'JPG'));
});

$('btn-jpg-laden').addEventListener('click', () => {
  const jpg = jpgBlob();
  if (jpg) herunterladen(jpg, dateiname(ym, 'jpg')).then((r) => meldeDownload(r, 'JPG'));
});

$('btn-leeren').addEventListener('click', () => {
  bestaetige({ titel: 'Monat leeren?', text: 'Alle Einträge für ' + ymText(ym) + ' werden gelöscht. Das kann nicht rückgängig gemacht werden.', ok: 'Ja, leeren', gefahr: true })
    .then((ja) => {
      if (!ja) return;
      monat.zeilen = [];
      protokolliere(monat, new Date().toISOString(), 'Monat geleert');
      monatGeaendert();
      zeigeMonat();
      toast('Monat geleert', 'warn');
    });
});

/** @param {'namen'|'alles'} art */
function uebernehmen(art) {
  const quelle = $('uebernahme').dataset.quelle || '';
  const q = speicher.daten.monate[quelle];
  if (!q) return;
  monatUebernehmen();
  uebernehmeZeilen(q, monat, art === 'alles', idGen);
  protokolliere(monat, new Date().toISOString(), 'Aus ' + ymText(quelle) + ' übernommen (' + (art === 'alles' ? 'mit Mengen' : 'nur Personen') + ')');
  monatGeaendert();
  zeigeMonat();
}
$('btn-uebernehmen-namen').addEventListener('click', () => uebernehmen('namen'));
$('btn-uebernehmen-alles').addEventListener('click', () => uebernehmen('alles'));

// ---------- Navigation ----------

$('monat-zurueck').addEventListener('click', () => wechsleMonat(-1));
$('monat-vor').addEventListener('click', () => wechsleMonat(1));

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') spiegel.flush();
});
window.addEventListener('pagehide', () => { spiegel.flush(); });

// ---------- Update ----------

const version = appVersion(document);
$('update-laden').addEventListener('click', () => {
  speichern();
  spiegel.flush().finally(() => location.reload());
});
$('update-schliessen').addEventListener('click', () => { $('update-banner').hidden = true; });
registriereServiceWorker(version);
starteUpdatePruefung(version, () => {
  $('update-banner').hidden = false;
  $('update-laden').focus();
});

erkenneDownloadDienst();
if (speicher.lade() === 'migriert') toast('Bisheriger Bestellschein übernommen ✓', 'ok');
ym = speicher.daten.aktuellerMonat;
zeigeMonat();
spiegel.start().then((uebernommen) => {
  if (uebernommen) { speichern(); zeigeMonat(); toast('Gespeicherte Eingaben geladen ✓', 'ok'); }
});
