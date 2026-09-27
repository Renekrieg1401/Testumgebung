// @ts-check
// Einstiegspunkt: Verdrahtung von Tresor, PIN-Gate, Tabelle, Monatsnavigation, Versiegelung,
// PDF/CSV-Export und Update-Mechanik. Fachlogik liegt in model.js, I/O in store.js/teilen.js.

import {
  entsiegle, istLeer, leereZeile, letzterBefuellterMonatVor, MAX_ZEILEN, neueId, neuerMonat, preiseHinterlegt,
  protokolliere, uebernehmeZeilen, versiegle, ymAus, ymText, ymVerschieben
} from './model.js';
import { erzeugeTresor } from './store.js';
import { erzeugeGate } from './gate.js';
import { erzeugeTabelle } from './tabelle.js';
import { erzeugeEinstellungen } from './einstellungen.js';
import { erzeugeSignaturPad } from './signatur.js';
import { erzeugeBestellPdf, pdfDateiname } from './bestellung-pdf.js';
import { erzeugeMonatsCsv } from './csv.js';
import { oeffneInTab, teileOderLade } from './teilen.js';
import { $, bestaetige, toast } from './dialoge.js';
import { appVersion, registriereServiceWorker, starteUpdatePruefung } from './update.js';

/** Sperre, wenn die App länger als diese Zeit im Hintergrund war. */
const SPERRE_NACH_MS = 60000;
const SPEICHER_VERZOEGERUNG_MS = 400;

/** @typedef {import('./model.js').Monat} Monat */

const tresor = erzeugeTresor(window.localStorage, {
  subtle: window.crypto.subtle,
  zufall: (a) => window.crypto.getRandomValues(a),
  jetzt: () => new Date()
});
const idGen = () => neueId(Math.random);

let ym = ymAus(new Date());
/** Anzeige-Monat; wird erst beim ersten Eintrag in den Datenbestand übernommen. @type {Monat} */
let monat = neuerMonat(new Date().toISOString());
/** @type {number|undefined} */
let speicherTimer;
let verstecktSeit = 0;

// ---------- Speichern ----------

/** @param {'speichert'|'ok'|'fehler'|''} art @param {string} text */
function status(art, text) {
  $('speicher-punkt').className = 'punkt' + (art ? ' punkt-' + art : '');
  $('speicher-text').textContent = text;
}

function jetztSpeichern() {
  window.clearTimeout(speicherTimer);
  speicherTimer = undefined;
  return tresor.speichere().then((erg) => {
    if (erg.ok) { status('ok', 'Verschlüsselt gespeichert'); return; }
    status('fehler', 'Nicht gespeichert!');
    toast(erg.grund === 'speicher' ? 'Speichern fehlgeschlagen — Gerätespeicher voll? Bitte Sicherung exportieren.' : 'Speichern fehlgeschlagen (Verschlüsselung).', 'fehler');
  });
}

function spaeterSpeichern() {
  status('speichert', 'Speichert …');
  monat.geaendert = new Date().toISOString();
  window.clearTimeout(speicherTimer);
  speicherTimer = window.setTimeout(jetztSpeichern, SPEICHER_VERZOEGERUNG_MS);
}

function monatUebernehmen() {
  if (!tresor.daten.monate[ym]) tresor.daten.monate[ym] = monat;
}

// ---------- Darstellung ----------

const tabelle = erzeugeTabelle(/** @type {HTMLTableElement} */ ($('tabelle')), {
  neueZeile() {
    if (monat.status !== 'entwurf' || monat.zeilen.length >= MAX_ZEILEN) return null;
    monatUebernehmen();
    const z = leereZeile(idGen());
    monat.zeilen.push(z);
    return z;
  },
  zeileGeaendert() { spaeterSpeichern(); zeigeKopfzeile(); },
  zeileEntfernen(id) {
    monat.zeilen = monat.zeilen.filter((z) => z.id !== id);
    spaeterSpeichern();
    zeigeMonat();
  }
});

function zeigeKopfzeile() {
  const versiegelt = monat.status === 'versiegelt';
  const befuellt = monat.zeilen.some((z) => !istLeer(z));
  $('monat-label').textContent = ymText(ym);
  const badge = $('status-badge');
  badge.textContent = versiegelt ? 'Versiegelt' : 'Entwurf';
  badge.className = 'badge ' + (versiegelt ? 'badge-versiegelt' : 'badge-entwurf');
  $('bestellnr').textContent = monat.bestellnr ? 'Bestell-Nr. ' + monat.bestellnr : '';
  $('versiegelt-hinweis').hidden = !versiegelt;
  if (versiegelt && monat.siegel) {
    $('versiegelt-text').textContent = 'Versiegelt am ' + new Date(monat.siegel.zeit).toLocaleString('de-DE') + ' von ' +
      monat.siegel.name + ' — schreibgeschützt.';
  }
  ['btn-pdf', 'btn-pdf-oeffnen', 'btn-csv'].forEach((id) => { /** @type {HTMLButtonElement} */ ($(id)).disabled = !befuellt; });
  /** @type {HTMLButtonElement} */ ($('btn-versiegeln')).disabled = versiegelt || !befuellt;
  /** @type {HTMLButtonElement} */ ($('btn-leeren')).disabled = versiegelt || !befuellt;
  $('budget-hinweis').hidden = preiseHinterlegt(tresor.daten.einstellungen);
}

function zeigeUebernahme() {
  const quelle = monat.status === 'entwurf' && monat.zeilen.length === 0 ? letzterBefuellterMonatVor(tresor.daten, ym) : null;
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
  const vorhanden = tresor.daten.monate[ym];
  if (vorhanden) vorhanden.zeilen = vorhanden.zeilen.filter((z) => !istLeer(z));
  monat = vorhanden || neuerMonat(new Date().toISOString());
  tabelle.zeige(monat, tresor.daten.einstellungen, monat.status === 'versiegelt');
  zeigeKopfzeile();
  zeigeUebernahme();
  zeigeProtokoll();
}

/** @param {number} delta */
function wechsleMonat(delta) {
  if (speicherTimer !== undefined) jetztSpeichern();
  ym = ymVerschieben(ym, delta);
  tresor.daten.aktuellerMonat = ym;
  zeigeMonat();
}

// ---------- Aktionen ----------

function pdfBlob() {
  return new Blob([erzeugeBestellPdf(tresor.daten, ym, monat, new Date())], { type: 'application/pdf' });
}

$('btn-pdf').addEventListener('click', () => {
  teileOderLade(pdfBlob(), pdfDateiname(ym, monat), 'Bestellung Pflegehilfsmittel ' + ymText(ym)).then((r) => {
    if (r === 'geteilt') toast('PDF geteilt ✓', 'ok');
    if (r === 'geladen') toast('PDF heruntergeladen ✓', 'ok');
  });
});

$('btn-pdf-oeffnen').addEventListener('click', () => {
  if (oeffneInTab(pdfBlob(), pdfDateiname(ym, monat)) === 'geladen') toast('Popup blockiert — PDF wurde heruntergeladen.', 'warn');
});

$('btn-csv').addEventListener('click', () => {
  const csv = erzeugeMonatsCsv(tresor.daten, ym, monat, new Date());
  const name = 'PflegeBox-' + ym + (monat.bestellnr ? '-' + monat.bestellnr : '') + '.csv';
  teileOderLade(new Blob([csv], { type: 'text/csv;charset=utf-8' }), name, 'Bestellübersicht ' + ymText(ym)).then((r) => {
    if (r !== 'abgebrochen') toast('CSV exportiert ✓', 'ok');
  });
});

$('btn-leeren').addEventListener('click', () => {
  bestaetige({ titel: 'Monat leeren?', text: 'Alle Einträge für ' + ymText(ym) + ' werden gelöscht. Das kann nicht rückgängig gemacht werden.', ok: 'Ja, leeren', gefahr: true })
    .then((ja) => {
      if (!ja) return;
      monat.zeilen = [];
      protokolliere(monat, new Date().toISOString(), 'Monat geleert');
      spaeterSpeichern();
      zeigeMonat();
      toast('Monat geleert', 'warn');
    });
});

$('btn-entsiegeln').addEventListener('click', () => {
  bestaetige({ titel: 'Versiegelung aufheben?', text: 'Die Unterschrift wird entfernt, der Monat wird wieder bearbeitbar. Die Bestell-Nr. ' +
    (monat.bestellnr || '') + ' bleibt erhalten; der Vorgang wird protokolliert.', ok: 'Aufheben', gefahr: true })
    .then((ja) => {
      if (!ja) return;
      entsiegle(monat, new Date().toISOString());
      spaeterSpeichern();
      zeigeMonat();
    });
});

/** @param {'namen'|'alles'} art */
function uebernehmen(art) {
  const quelle = $('uebernahme').dataset.quelle || '';
  const q = tresor.daten.monate[quelle];
  if (!q) return;
  monatUebernehmen();
  uebernehmeZeilen(q, monat, art === 'alles', idGen);
  protokolliere(monat, new Date().toISOString(), 'Aus ' + ymText(quelle) + ' übernommen (' + (art === 'alles' ? 'mit Mengen' : 'nur Personen') + ')');
  spaeterSpeichern();
  zeigeMonat();
}
$('btn-uebernehmen-namen').addEventListener('click', () => uebernehmen('namen'));
$('btn-uebernehmen-alles').addEventListener('click', () => uebernehmen('alles'));

// ---------- Versiegeln mit Unterschrift ----------

const signaturDlg = /** @type {HTMLDialogElement} */ ($('dlg-signatur'));
const pad = erzeugeSignaturPad(/** @type {HTMLCanvasElement} */ ($('signatur-canvas')));

$('btn-versiegeln').addEventListener('click', () => {
  $('signatur-titel').textContent = 'Bestellung ' + ymText(ym) + ' versiegeln';
  $('signatur-fehler').textContent = '';
  signaturDlg.showModal();
  window.requestAnimationFrame(pad.vorbereiten);
});
$('signatur-leeren').addEventListener('click', pad.leeren);
$('signatur-form').addEventListener('submit', (e) => {
  const submitter = /** @type {SubmitEvent} */ (e).submitter;
  if (submitter && submitter.getAttribute('value') === 'abbrechen') return;
  const name = /** @type {HTMLInputElement} */ ($('signatur-name')).value.trim();
  if (!name || !pad.hatInhalt()) {
    e.preventDefault();
    $('signatur-fehler').textContent = !name ? 'Bitte Namen der unterzeichnenden Person eingeben.' : 'Bitte im Feld unterschreiben.';
    return;
  }
  monatUebernehmen();
  versiegle(tresor.daten, ym, monat, { name: name.slice(0, 80), sig: pad.alsJpeg(), zeit: new Date().toISOString() });
  jetztSpeichern();
  zeigeMonat();
  toast('Versiegelt — ' + monat.bestellnr, 'ok');
});

// ---------- Einstellungen, Navigation, Sperre ----------

const einstellungen = erzeugeEinstellungen(tresor, {
  gespeichert() { jetztSpeichern(); zeigeMonat(); toast('Einstellungen gespeichert', 'ok'); },
  wiederhergestellt() { ym = tresor.daten.aktuellerMonat; zeigeMonat(); status('ok', 'Wiederhergestellt'); }
});
$('btn-einstellungen').addEventListener('click', () => einstellungen.oeffne());
$('budget-link').addEventListener('click', () => einstellungen.oeffne());
$('monat-zurueck').addEventListener('click', () => wechsleMonat(-1));
$('monat-vor').addEventListener('click', () => wechsleMonat(1));

const gate = erzeugeGate(tresor, window.localStorage, {
  entsperrt() {
    ym = tresor.daten.aktuellerMonat;
    zeigeMonat();
    status('ok', 'Entsperrt');
  },
  gesperrt() {
    if (speicherTimer !== undefined) jetztSpeichern();
    document.querySelectorAll('dialog[open]').forEach((d) => /** @type {HTMLDialogElement} */ (d).close('abbrechen'));
    tabelle.leeren();
  }
});
$('btn-sperren').addEventListener('click', () => gate.sperre());

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    verstecktSeit = Date.now();
    document.body.classList.add('verdeckt');
    if (speicherTimer !== undefined) jetztSpeichern();
    return;
  }
  document.body.classList.remove('verdeckt');
  if (verstecktSeit && Date.now() - verstecktSeit > SPERRE_NACH_MS) gate.sperre();
  verstecktSeit = 0;
});
window.addEventListener('pagehide', () => { if (speicherTimer !== undefined) jetztSpeichern(); });

// ---------- Update ----------

const version = appVersion(document);
$('update-laden').addEventListener('click', () => location.reload());
$('update-schliessen').addEventListener('click', () => { $('update-banner').hidden = true; });
registriereServiceWorker(version);
starteUpdatePruefung(version, () => { $('update-banner').hidden = false; });

gate.start();
