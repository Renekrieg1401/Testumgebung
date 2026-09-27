// @ts-check
// Native <dialog>-Modale (Fokusfalle, Esc, inert-Hintergrund vom Browser) + Toast.

/** @param {string} id @returns {HTMLElement} */
export function $(id) {
  const e = document.getElementById(id);
  if (!e) throw new Error('Element #' + id + ' fehlt');
  return e;
}

/**
 * Bestätigungsdialog. Liefert true bei Bestätigung.
 * @param {{ titel: string, text: string, ok: string, abbrechen?: string, gefahr?: boolean }} opt @returns {Promise<boolean>}
 */
export function bestaetige(opt) {
  const dlg = /** @type {HTMLDialogElement} */ ($('dlg-bestaetigen'));
  $('dlg-bestaetigen-titel').textContent = opt.titel;
  $('dlg-bestaetigen-text').textContent = opt.text;
  const ok = $('dlg-bestaetigen-ok');
  ok.textContent = opt.ok;
  ok.className = 'btn ' + (opt.gefahr ? 'btn-gefahr' : 'btn-primaer');
  $('dlg-bestaetigen-abbrechen').textContent = opt.abbrechen || 'Abbrechen';
  dlg.returnValue = '';
  dlg.showModal();
  $('dlg-bestaetigen-abbrechen').focus();
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
  });
}

/** @type {number|undefined} */
let toastTimer;

/** @param {string} text @param {'info'|'ok'|'warn'|'fehler'} [art] */
export function toast(text, art) {
  const t = $('toast');
  t.textContent = text;
  t.className = 'toast sichtbar toast-' + (art || 'info');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { t.className = 'toast'; }, 3600);
}
