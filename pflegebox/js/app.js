// @ts-check
// Einstiegspunkt: Verdrahtung von Speicher, Tabelle, Monatsnavigation, PDF-/JPG-Export
// und Update-Mechanik. Fachlogik liegt in model.js, I/O in store.js/teilen.js.

import {
  istLeer, leereZeile, letzterBefuellterMonatVor, MAX_ZEILEN, neueId, neuerMonat,
  schliesseAb, stelleGesendeteWiederHer, uebernehmeZeilen, ymAus, ymText, ymVerschieben
} from './model.js';
import { erzeugeSpeicher } from './store.js';
import { erzeugeSpiegel } from './spiegel.js';
import { erzeugeTabelle } from './tabelle.js';
import { dateiname, erzeugeBestellJpeg, erzeugeBestellPdf } from './bestellung.js';
import { erkenneDownloadDienst, herunterladen, teileOderLade } from './teilen.js';
import { $, bestaetige, toast } from './dialoge.js';
import { aktiviereNeueVersion, appVersion, registriereServiceWorker, starteUpdatePruefung } from './update.js';


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

function zeigeGesendet() {
  const g = monat.zeilen.length === 0 ? monat.gesendet : null;
  $('gesendet-hinweis').hidden = !g;
  if (g) {
    $('gesendet-text').textContent = 'Bestellung (' + g.zeilen.length + ' Pers.) wurde am ' + new Date(g.zeit).toLocaleString('de-DE') +
      ' als ' + g.format + ' gesendet/gespeichert und zurückgesetzt. Nicht angekommen?';
  }
}

function zeigeUebernahme() {
  const quelle = monat.zeilen.length === 0 && !monat.gesendet ? letzterBefuellterMonatVor(speicher.daten, ym) : null;
  $('uebernahme').hidden = !quelle;
  if (quelle) $('uebernahme-text').textContent = 'Noch keine Einträge. Personen aus ' + ymText(quelle) + ' übernehmen?';
  $('uebernahme').dataset.quelle = quelle || '';
}

function zeigeMonat() {
  const vorhanden = speicher.daten.monate[ym];
  if (vorhanden) vorhanden.zeilen = vorhanden.zeilen.filter((z) => !istLeer(z));
  monat = vorhanden || neuerMonat(new Date().toISOString());
  tabelle.zeige(monat);
  zeigeKopfzeile();
  zeigeGesendet();
  zeigeUebernahme();
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

/**
 * Setzt die Eingaben erst zurück, wenn Senden/Speichern nachweislich abgeschlossen ist. Bei unbestätigtem
 * Browser-Download wird nachgefragt; bei Abbruch/Fehler bleibt alles erhalten.
 * @param {import('./teilen.js').TeilErgebnis} r @param {import('./model.js').Format} format
 * @param {import('./model.js').Monat} m @param {string} ymExport
 */
function nachExport(r, format, m, ymExport) {
  const abschliessen = () => {
    schliesseAb(m, format, new Date().toISOString());
    speichern();
    spiegel.markiere(ymExport);
    if (ymExport === ym) zeigeMonat();
    toast(format + (r === 'geteilt' ? ' geteilt' : ' gespeichert') + ' ✓ — Eingaben zurückgesetzt', 'ok');
  };
  if (r === 'geteilt' || r === 'gespeichert') { abschliessen(); return; }
  if (r === 'abgebrochen') { toast('Abgebrochen — Eingaben bleiben erhalten', 'info'); return; }
  if (r === 'fehler') { toast(format + ' konnte nicht gespeichert werden — Eingaben bleiben erhalten', 'fehler'); return; }
  bestaetige({
    titel: 'Download abgeschlossen?',
    text: 'Wurde die ' + format + '-Datei gespeichert? Dann werden die Eingaben zurückgesetzt. Die Bestellung lässt sich danach über „Wiederherstellen“ zurückholen.',
    ok: 'Ja, zurücksetzen', abbrechen: 'Nein, behalten'
  }).then((ja) => { if (ja) abschliessen(); else toast('Eingaben bleiben erhalten', 'info'); });
}

/**
 * @param {Blob|null} blob @param {import('./model.js').Format} format @param {boolean} teilen
 */
function exportiere(blob, format, teilen) {
  if (!blob) return;
  const m = monat, ymExport = ym;
  const name = dateiname(ymExport, format === 'PDF' ? 'pdf' : 'jpg');
  const vorgang = teilen ? teileOderLade(blob, name, 'Bestellung Pflegehilfsmittel ' + ymText(ymExport)) : herunterladen(blob, name);
  vorgang.then((r) => nachExport(r, format, m, ymExport));
}

$('btn-pdf').addEventListener('click', () => exportiere(pdfBlob(), 'PDF', true));
$('btn-pdf-laden').addEventListener('click', () => exportiere(pdfBlob(), 'PDF', false));

/** Erzeugt das JPG synchron (Teilen bleibt im Klick-Gesten-Kontext). @returns {Blob|null} */
function jpgBlob() {
  try {
    return new Blob([erzeugeBestellJpeg(speicher.daten, ym, monat, new Date())], { type: 'image/jpeg' });
  } catch (err) {
    toast('JPG konnte nicht erstellt werden: ' + (err instanceof Error ? err.message : String(err)), 'fehler');
    return null;
  }
}

$('btn-jpg').addEventListener('click', () => exportiere(jpgBlob(), 'JPG', true));
$('btn-jpg-laden').addEventListener('click', () => exportiere(jpgBlob(), 'JPG', false));

$('btn-wiederherstellen').addEventListener('click', () => {
  if (!stelleGesendeteWiederHer(monat, new Date().toISOString())) return;
  speichern();
  spiegel.markiere(ym);
  zeigeMonat();
  toast('Bestellung wiederhergestellt ✓', 'ok');
});

$('btn-leeren').addEventListener('click', () => {
  bestaetige({ titel: 'Monat leeren?', text: 'Alle Einträge für ' + ymText(ym) + ' werden gelöscht. Das kann nicht rückgängig gemacht werden.', ok: 'Ja, leeren', gefahr: true })
    .then((ja) => {
      if (!ja) return;
      monat.zeilen = [];
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
let neueVersion = '';
$('update-laden').addEventListener('click', () => {
  const knopf = /** @type {HTMLButtonElement} */ ($('update-laden'));
  knopf.disabled = true;
  knopf.textContent = 'Wird aktualisiert …';
  speichern();
  Promise.all([spiegel.flush(), aktiviereNeueVersion(neueVersion)]).finally(() => location.reload());
});
$('update-schliessen').addEventListener('click', () => { $('update-banner').hidden = true; });
registriereServiceWorker(version);
starteUpdatePruefung(version, (neu) => {
  neueVersion = neu;
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
