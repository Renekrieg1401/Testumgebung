// @ts-check
// Bestelltabelle: DOM-Aufbau aus ARTIKEL (Single Source of Truth), Event-Delegation, Personen-Kacheln
// per „+“ hinzufügen und per „−“ entfernen (Ersatz für die starren 16 Zeilen), Summenzeile.

import { ARTIKEL, MAX_PACKUNGEN, MAX_ZEILEN, summen } from './model.js';

/**
 * @typedef {import('./model.js').Zeile} Zeile
 * @typedef {import('./model.js').Monat} Monat
 * @typedef {{
 *   neueZeile: () => Zeile|null,
 *   zeileGeaendert: (z: Zeile) => void,
 *   zeileEntfernen: (id: string) => void,
 *   limitErreicht: () => void
 * }} TabellenCallbacks
 */

/**
 * @param {string} tag @param {Record<string, string>} attrs @param {(Node|string)[]} [kinder]
 * @returns {HTMLElement}
 */
function el(tag, attrs, kinder) {
  const e = document.createElement(tag);
  Object.keys(attrs).forEach((k) => e.setAttribute(k, attrs[k]));
  (kinder || []).forEach((k) => e.append(k));
  return e;
}

/** @param {HTMLTableElement} tabelle */
function baueKopf(tabelle) {
  const kopf = el('tr', {}, [
    el('th', { scope: 'col', class: 'sp-nr' }, ['Nr.']),
    el('th', { scope: 'col', class: 'sp-name' }, ['Name']),
    ...ARTIKEL.map((a) => el('th', { scope: 'col', title: a.label }, [a.kurz])),
    el('th', { scope: 'col', class: 'sp-inko', title: 'Inkontinenzmaterial (Versorgung über SGB V)' }, ['Inko']),
    el('th', { scope: 'col', class: 'sp-aktion' }, [el('span', { class: 'sr-only' }, ['Aktion'])])
  ]);
  tabelle.tHead?.replaceChildren(kopf);
}

/** @param {number} nr @returns {HTMLElement} */
function minusKnopf(nr) {
  return el('button', { type: 'button', class: 'btn-minus', 'data-aktion': 'entfernen',
    'aria-label': 'Person ' + nr + ' entfernen', title: 'Person entfernen' }, ['−']);
}

/** Letzte Tabellenzeile mit dem „+“ für eine weitere Person. @returns {HTMLTableRowElement} */
function baueplusZeile() {
  const knopf = el('button', { type: 'button', class: 'btn-plus', 'data-aktion': 'neu', id: 'btn-person-neu',
    'aria-label': 'Weitere Person hinzufügen', title: 'Weitere Person hinzufügen' }, ['+']);
  const zelle = el('td', { colspan: String(ARTIKEL.length + 4), class: 'sp-plus' }, [knopf, el('span', { 'aria-hidden': 'true' }, ['Weitere Person'])]);
  return /** @type {HTMLTableRowElement} */ (el('tr', { class: 'plus-zeile' }, [zelle]));
}

/** @param {Zeile|null} z @param {number} nr @returns {HTMLTableRowElement} */
function baueZeile(z, nr) {
  const suffix = ', Zeile ' + nr;
  const name = el('input', { type: 'text', 'data-feld': 'name', maxlength: '80', autocomplete: 'off',
    'aria-label': 'Name' + suffix, placeholder: z ? '' : 'Name eintragen …' });
  /** @type {HTMLInputElement} */ (name).value = z ? z.name : '';
  const artikel = ARTIKEL.map((a) => {
    const label = a.label + (a.typ === 'menge' ? ' (Packungen)' : '') + suffix;
    let feld;
    if (a.typ === 'menge') {
      const opts = [];
      for (let v = 0; v <= MAX_PACKUNGEN; v++) opts.push(el('option', { value: String(v) }, [v === 0 ? '–' : String(v)]));
      feld = el('select', { 'data-feld': a.key, 'aria-label': label }, opts);
      /** @type {HTMLSelectElement} */ (feld).value = String(z ? z[a.key] : 0);
    } else {
      feld = el('input', { type: 'checkbox', 'data-feld': a.key, 'aria-label': label });
      /** @type {HTMLInputElement} */ (feld).checked = z ? z[a.key] === true : false;
    }
    return el('td', { 'data-label': a.kurz }, [feld]);
  });
  const inko = el('input', { type: 'text', 'data-feld': 'inko', maxlength: '80', autocomplete: 'off',
    'aria-label': 'Inkontinenzmaterial' + suffix });
  /** @type {HTMLInputElement} */ (inko).value = z ? z.inko : '';
  const entfernen = minusKnopf(nr);
  const tr = /** @type {HTMLTableRowElement} */ (el('tr', { 'data-id': z ? z.id : '' }, [
    el('td', { class: 'sp-nr', 'data-label': 'Nr.' }, [String(nr)]),
    el('td', { class: 'sp-name', 'data-label': 'Name' }, [name]),
    ...artikel,
    el('td', { class: 'sp-inko', 'data-label': 'Inko' }, [inko]),
    el('td', { class: 'sp-aktion' }, [entfernen])
  ]));
  if (!z) tr.classList.add('leerzeile');
  return tr;
}

/** @param {HTMLElement} feld @param {Zeile} z */
function uebernimmFeld(feld, z) {
  const k = feld.dataset.feld;
  if (k === 'name' || k === 'inko') { z[k] = /** @type {HTMLInputElement} */ (feld).value.slice(0, 80); return; }
  const a = ARTIKEL.find((x) => x.key === k);
  if (!a) return;
  if (a.typ === 'menge') {
    const v = Number(/** @type {HTMLSelectElement} */ (feld).value);
    /** @type {Record<string, number|boolean|string>} */ (z)[a.key] = Math.min(MAX_PACKUNGEN, Math.max(0, Number.isFinite(v) ? v : 0));
  } else {
    /** @type {Record<string, number|boolean|string>} */ (z)[a.key] = /** @type {HTMLInputElement} */ (feld).checked;
  }
}

/**
 * @param {HTMLTableElement} tabelle @param {TabellenCallbacks} cb
 */
export function erzeugeTabelle(tabelle, cb) {
  const tbody = tabelle.tBodies[0];
  const tfoot = tabelle.tFoot;
  /** @type {Monat|null} */
  let monat = null;
  baueKopf(tabelle);

  /** @param {string} id @returns {Zeile|undefined} */
  const finde = (id) => (monat ? monat.zeilen.find((z) => z.id === id) : undefined);

  const plusZeile = baueplusZeile();
  /** @returns {HTMLTableRowElement[]} */
  const personen = () => /** @type {HTMLTableRowElement[]} */ (Array.from(tbody.rows).filter((tr) => tr !== plusZeile));

  /** @returns {HTMLTableRowElement|null} */
  function haengeLeerzeileAn() {
    const anzahl = personen().length;
    if (!monat || anzahl >= MAX_ZEILEN) return null;
    const tr = baueZeile(null, anzahl + 1);
    tbody.insertBefore(tr, plusZeile);
    return tr;
  }

  /** Neue, leere Personen-Kachel; Fokus ins Namensfeld. */
  function neuePerson() {
    const tr = haengeLeerzeileAn();
    if (!tr) { cb.limitErreicht(); return; }
    const name = /** @type {HTMLInputElement|null} */ (tr.querySelector('[data-feld="name"]'));
    if (name) { name.focus(); name.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }

  function nummeriere() {
    personen().forEach((tr, i) => {
      const nr = tr.querySelector('.sp-nr');
      if (nr) nr.textContent = String(i + 1);
      const minus = tr.querySelector('[data-aktion="entfernen"]');
      if (minus) minus.setAttribute('aria-label', 'Person ' + (i + 1) + ' entfernen');
    });
  }

  function summenZeile() {
    if (!tfoot || !monat) return;
    const s = summen(monat.zeilen);
    tfoot.replaceChildren(el('tr', {}, [
      el('th', { scope: 'row', colspan: '2', class: 'sp-name' }, ['Summe (' + s.personen + ' Pers.)']),
      ...ARTIKEL.map((a) => el('td', { 'data-label': a.kurz }, [String(s[a.key])])),
      el('td', { class: 'sp-inko', 'data-label': 'Inko' }, [s.inko ? s.inko + ' Pers.' : '–']),
      el('td', { class: 'sp-aktion' }, [''])
    ]));
  }

  /** @param {Event} e */
  function beiEingabe(e) {
    const feld = /** @type {HTMLElement} */ (e.target);
    if (!monat || !feld.dataset || !feld.dataset.feld) return;
    const tr = /** @type {HTMLTableRowElement|null} */ (feld.closest('tr'));
    if (!tr) return;
    let z = finde(tr.dataset.id || '');
    if (!z) {
      const neu = cb.neueZeile();
      if (!neu) return;
      z = neu;
      tr.dataset.id = z.id;
      tr.classList.remove('leerzeile');
      tr.querySelectorAll('[data-feld]').forEach((f) => uebernimmFeld(/** @type {HTMLElement} */ (f), /** @type {Zeile} */ (z)));
    }
    uebernimmFeld(feld, z);
    summenZeile();
    cb.zeileGeaendert(z);
  }

  tbody.addEventListener('input', beiEingabe);
  tbody.addEventListener('change', beiEingabe);
  tbody.addEventListener('click', (e) => {
    if (/** @type {HTMLElement} */ (e.target).closest('[data-aktion="neu"]')) { neuePerson(); return; }
    const btn = /** @type {HTMLElement} */ (e.target).closest('[data-aktion="entfernen"]');
    const tr = btn ? /** @type {HTMLTableRowElement|null} */ (btn.closest('tr')) : null;
    if (!tr) return;
    if (tr.dataset.id) { cb.zeileEntfernen(tr.dataset.id); return; }
    tr.remove();
    nummeriere();
  });

  return {
    /** @param {Monat|null} m */
    zeige(m) {
      monat = m;
      const zeilen = m ? m.zeilen : [];
      tbody.replaceChildren(...zeilen.map((z, i) => baueZeile(z, i + 1)), plusZeile);
      if (!m) { if (tfoot) tfoot.replaceChildren(); return; }
      if (zeilen.length === 0) haengeLeerzeileAn();
      summenZeile();
    }
  };
}
