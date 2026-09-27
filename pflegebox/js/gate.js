// @ts-check
// PIN-Gate (AERIS: aePinGateStart) — Einrichtung, Entsperren, Migration des Klartext-Altbestands,
// erneute Sperre (manuell oder nach Hintergrundzeit). Hintergrund (Kopf/Hauptbereich) ist bis zur
// Entsperrung inert und aria-hidden.

import { $, bestaetige } from './dialoge.js';
import { erkenneModus, pinGueltig } from './store.js';

/**
 * @typedef {import('./store.js').Tresor} Tresor
 * @typedef {import('./store.js').Speicher} Speicher
 * @typedef {'setup'|'unlock'|'migrate'|'relock'} Modus
 */

const TEXTE = /** @type {Readonly<Record<Modus, { hinweis: string, knopf: string, doppelt: boolean }>>} */ (Object.freeze({
  setup: { hinweis: 'Erststart: Legen Sie eine PIN (6–8 Ziffern) fest. Sie schützt Namen und Bestelldaten (Gesundheitsdaten).', knopf: 'PIN festlegen', doppelt: true },
  migrate: { hinweis: 'Sicherheits-Update: Bitte eine PIN festlegen. Ihr bisheriger Bestellschein wird danach verschlüsselt übernommen, nicht gelöscht.', knopf: 'PIN festlegen & Daten verschlüsseln', doppelt: true },
  unlock: { hinweis: 'Bitte PIN eingeben, um die gespeicherten Daten zu entschlüsseln.', knopf: 'Entsperren', doppelt: false },
  relock: { hinweis: 'Die App wurde gesperrt. Bitte PIN erneut eingeben.', knopf: 'Entsperren', doppelt: false }
}));

const FEHLER = /** @type {Readonly<Record<string, string>>} */ (Object.freeze({
  pin: 'Falsche PIN — die Daten können damit nicht entschlüsselt werden.',
  defekt: 'Gespeicherte Daten sind beschädigt oder nicht lesbar.',
  speicher: 'Speichern fehlgeschlagen — Gerätespeicher voll oder gesperrt (privater Modus?).',
  krypto: 'Verschlüsselung fehlgeschlagen. Es wurde nichts verändert — bitte erneut versuchen.',
  altbestand: 'Der bisherige Bestellschein konnte nicht gelesen werden — Migration abgebrochen, nichts verändert.'
}));

/**
 * @param {Tresor} tresor @param {Speicher} speicher
 * @param {{ entsperrt: () => void, gesperrt: () => void }} cb
 */
export function erzeugeGate(tresor, speicher, cb) {
  const gate = $('gate');
  const form = /** @type {HTMLFormElement} */ ($('gate-form'));
  const pin = /** @type {HTMLInputElement} */ ($('gate-pin'));
  const pin2 = /** @type {HTMLInputElement} */ ($('gate-pin2'));
  const wrap2 = $('gate-pin2-wrap');
  const fehler = $('gate-fehler');
  const knopf = /** @type {HTMLButtonElement} */ ($('gate-los'));
  const hintergrund = [$('kopf'), $('haupt'), $('aktionen')];
  /** @type {Modus} */
  let modus = 'setup';

  /** @param {boolean} an */
  function sperreHintergrund(an) {
    hintergrund.forEach((e) => {
      e.toggleAttribute('inert', an);
      if (an) e.setAttribute('aria-hidden', 'true'); else e.removeAttribute('aria-hidden');
    });
  }

  function konfiguriere() {
    const t = TEXTE[modus];
    $('gate-hinweis').textContent = t.hinweis;
    knopf.textContent = t.knopf;
    wrap2.hidden = !t.doppelt;
    pin2.required = t.doppelt;
    pin.autocomplete = t.doppelt ? 'new-password' : 'current-password';
    $('gate-hilfe').hidden = modus === 'setup' || modus === 'migrate';
    fehler.textContent = '';
    pin.value = ''; pin2.value = '';
    knopf.disabled = false;
  }

  function zeige() {
    konfiguriere();
    gate.hidden = false;
    sperreHintergrund(true);
    pin.focus();
  }

  /** @returns {Promise<import('./store.js').Ergebnis>} */
  async function fuehreAus() {
    const p = pin.value.trim();
    if (!pinGueltig(p)) return Promise.reject(new Error('Bitte eine PIN aus 6–8 Ziffern eingeben.'));
    if (modus === 'unlock') return tresor.entsperre(p);
    if (modus === 'relock') return tresor.pruefePin(p);
    if (p !== pin2.value.trim()) return Promise.reject(new Error('Die beiden PIN-Eingaben stimmen nicht überein.'));
    return tresor.richteEin(p, modus === 'migrate');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    fehler.textContent = '';
    knopf.disabled = true;
    knopf.setAttribute('aria-busy', 'true');
    fuehreAus().then((erg) => {
      if (!erg.ok) { fehler.textContent = FEHLER[erg.grund]; return; }
      modus = 'relock';
      pin.value = ''; pin2.value = '';
      pin.blur();
      gate.hidden = true;
      sperreHintergrund(false);
      cb.entsperrt();
    }, (err) => {
      fehler.textContent = err instanceof Error ? err.message : String(err);
    }).finally(() => {
      knopf.disabled = false;
      knopf.removeAttribute('aria-busy');
    });
  });

  $('gate-reset').addEventListener('click', () => {
    bestaetige({
      titel: 'Alle Daten löschen?',
      text: 'Ohne PIN lassen sich die verschlüsselten Daten nicht wiederherstellen. Alle Bestellungen, Unterschriften und Einstellungen auf diesem Gerät werden endgültig gelöscht.',
      ok: 'Endgültig löschen', gefahr: true
    }).then((ja) => {
      if (!ja) return;
      tresor.loescheAlles();
      modus = 'setup';
      zeige();
    });
  });

  return {
    start() {
      if (!window.crypto || !window.crypto.subtle) {
        $('gate-hinweis').textContent = 'Verschlüsselung wird hier nicht unterstützt (crypto.subtle fehlt). Bitte einen aktuellen Browser über HTTPS verwenden.';
        knopf.disabled = true;
        gate.hidden = false;
        sperreHintergrund(true);
        return;
      }
      modus = erkenneModus(speicher);
      zeige();
    },
    sperre() {
      if (!tresor.entsperrt || !gate.hidden) return;
      modus = 'relock';
      cb.gesperrt();
      zeige();
    }
  };
}
