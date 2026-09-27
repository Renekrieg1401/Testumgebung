// @ts-check
// Einstellungsdialog: Besteller/Lieferant (Briefkopf), Pauschale + Stückpreise (Budgetprüfung),
// Speicherstand, verschlüsselte Datensicherung/Wiederherstellung, vollständige Löschung.

import { ARTIKEL, euro, parseEuro } from './model.js';
import { $, bestaetige, toast } from './dialoge.js';
import { pinGueltig } from './store.js';
import { herunterladen } from './teilen.js';

/**
 * @typedef {import('./store.js').Tresor} Tresor
 * @typedef {import('./model.js').Einstellungen} Einstellungen
 */

const TEXTFELDER = /** @type {const} */ ([
  ['abs-name', 'absender', 'name'], ['abs-strasse', 'absender', 'strasse'], ['abs-ort', 'absender', 'ort'],
  ['abs-telefon', 'absender', 'telefon'], ['lief-name', 'lieferant', 'name'], ['lief-kundennr', 'lieferant', 'kundennr'],
  ['lief-email', 'lieferant', 'email']
]);

/** @param {string} id */
const eingabe = (id) => /** @type {HTMLInputElement} */ ($(id));

function bauePreisfelder() {
  const ziel = $('preis-felder');
  ziel.replaceChildren(...ARTIKEL.map((a) => {
    const label = document.createElement('label');
    label.htmlFor = 'preis-' + a.key;
    label.textContent = a.label + ' (je Packung)';
    const input = document.createElement('input');
    Object.assign(input, { id: 'preis-' + a.key, type: 'text', inputMode: 'decimal', autocomplete: 'off', placeholder: '0,00' });
    const div = document.createElement('div');
    div.className = 'feld';
    div.append(label, input);
    return div;
  }));
}

/** @param {Einstellungen} e */
function fuelle(e) {
  TEXTFELDER.forEach(([id, gruppe, feld]) => { eingabe(id).value = /** @type {Record<string, string>} */ (e[gruppe])[feld]; });
  eingabe('budget').value = euro(e.budgetCent).replace(' €', '').replace(/\./g, '');
  ARTIKEL.forEach((a) => {
    const c = e.preiseCent[a.key];
    eingabe('preis-' + a.key).value = c > 0 ? euro(c).replace(' €', '').replace(/\./g, '') : '';
  });
}

/** @param {Einstellungen} e @returns {boolean} */
function uebernimm(e) {
  let gueltig = true;
  /** @param {string} id @returns {number} */
  const betrag = (id) => {
    const f = eingabe(id);
    const cent = parseEuro(f.value);
    f.setAttribute('aria-invalid', cent === null ? 'true' : 'false');
    if (cent === null) gueltig = false;
    return cent === null ? 0 : cent;
  };
  const budget = betrag('budget');
  const preise = ARTIKEL.map((a) => /** @type {const} */ ([a.key, betrag('preis-' + a.key)]));
  if (!gueltig) return false;
  TEXTFELDER.forEach(([id, gruppe, feld]) => { /** @type {Record<string, string>} */ (e[gruppe])[feld] = eingabe(id).value.trim().slice(0, 120); });
  e.budgetCent = budget;
  preise.forEach(([k, c]) => { e.preiseCent[k] = c; });
  return true;
}

function zeigeSpeicherstand() {
  const t = $('speicherstand');
  if (!navigator.storage || !navigator.storage.estimate) { t.textContent = 'Speicherstand in diesem Browser nicht ermittelbar.'; return; }
  navigator.storage.estimate().then((est) => {
    const quota = est.quota || 0, usage = est.usage || 0;
    t.textContent = quota ? 'Belegt: ' + (usage / 1048576).toFixed(1) + ' MB von ' + (quota / 1048576).toFixed(0) + ' MB (' +
      Math.round((usage / quota) * 100) + ' %)' : 'Speicherstand nicht ermittelbar.';
  }, () => { t.textContent = 'Speicherstand nicht ermittelbar.'; });
}

/**
 * @param {Tresor} tresor @param {{ gespeichert: () => void, wiederhergestellt: () => void }} cb
 */
export function erzeugeEinstellungen(tresor, cb) {
  const dlg = /** @type {HTMLDialogElement} */ ($('dlg-einstellungen'));
  const form = /** @type {HTMLFormElement} */ ($('einstellungen-form'));
  bauePreisfelder();

  form.addEventListener('submit', (e) => {
    const submitter = /** @type {SubmitEvent} */ (e).submitter;
    if (submitter && submitter.getAttribute('value') === 'abbrechen') return;
    if (!uebernimm(tresor.daten.einstellungen)) {
      e.preventDefault();
      $('einstellungen-fehler').textContent = 'Bitte Beträge im Format 12,34 eingeben.';
      return;
    }
    cb.gespeichert();
  });

  $('btn-sicherung').addEventListener('click', () => {
    const inhalt = tresor.sicherung();
    if (!inhalt) { toast('Noch keine Daten zum Sichern.', 'warn'); return; }
    const d = new Date();
    herunterladen(new Blob([inhalt], { type: 'application/json' }), 'PflegeBox-Sicherung-' + d.toISOString().slice(0, 10) + '.json');
    toast('Verschlüsselte Sicherung gespeichert.', 'ok');
  });

  $('btn-wiederherstellen').addEventListener('click', () => {
    const datei = /** @type {HTMLInputElement} */ ($('sicherung-datei')).files?.[0];
    const pin = eingabe('sicherung-pin').value.trim();
    if (!datei || !pinGueltig(pin)) { toast('Sicherungsdatei wählen und deren PIN (6–8 Ziffern) eingeben.', 'warn'); return; }
    bestaetige({ titel: 'Sicherung wiederherstellen?', text: 'Der aktuelle Datenstand auf diesem Gerät wird durch die Sicherung ersetzt. Danach gilt die PIN der Sicherung.', ok: 'Wiederherstellen', gefahr: true })
      .then((ja) => (ja ? datei.text().then((txt) => tresor.stelleWiederHer(txt, pin)) : null))
      .then((erg) => {
        if (!erg) return;
        if (!erg.ok) { toast(erg.grund === 'pin' ? 'PIN passt nicht zur Sicherung.' : 'Sicherung ungültig oder nicht speicherbar.', 'fehler'); return; }
        eingabe('sicherung-pin').value = '';
        dlg.close('abbrechen');
        cb.wiederhergestellt();
        toast('Sicherung wiederhergestellt.', 'ok');
      });
  });

  $('btn-alles-loeschen').addEventListener('click', () => {
    bestaetige({ titel: 'Alle Daten löschen?', text: 'Alle Bestellungen, Unterschriften, Einstellungen und die PIN werden auf diesem Gerät endgültig gelöscht.', ok: 'Endgültig löschen', gefahr: true })
      .then((ja) => { if (ja) { tresor.loescheAlles(); location.reload(); } });
  });

  return {
    oeffne() {
      fuelle(tresor.daten.einstellungen);
      $('einstellungen-fehler').textContent = '';
      zeigeSpeicherstand();
      dlg.showModal();
    }
  };
}
