// @ts-check
// Bestelltabelle: DOM-Aufbau aus ARTIKEL (Single Source of Truth), Event-Delegation, automatische
// Leerzeile am Ende (Ersatz für die starren 16 Zeilen), Budget-Ampel je Person, Summenzeile.

import { ARTIKEL, MAX_PACKUNGEN, MAX_ZEILEN, budgetZeile, euro, istLeer, preiseHinterlegt, summen } from './model.js';

/**
 * @typedef {import('./model.js').Zeile} Zeile
 * @typedef {import('./model.js').Monat} Monat
 * @typedef {import('./model.js').Einstellungen} Einstellungen
 * @typedef {{
 *   neueZeile: () => Zeile|null,
 *   zeileGeaendert: (z: Zeile) => void,
 *   zeileEntfernen: (id: string) => void
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
    el('th', { scope: 'col', class: 'sp-budget', title: 'Kosten gegenüber Pauschale § 40 Abs. 2 SGB XI' }, ['Budget']),
    el('th', { scope: 'col', class: 'sp-aktion' }, [el('span', { class: 'sr-only' }, ['Aktion'])])
  ]);
  tabelle.tHead?.replaceChildren(kopf);
}

/** @param {Zeile|null} z @param {number} nr @param {boolean} nurLesen @returns {HTMLTableRowElement} */
function baueZeile(z, nr, nurLesen) {
  const suffix = ', Zeile ' + nr;
  /** @type {Record<string, string>} */
  const dis = nurLesen ? { disabled: '' } : {};
  const name = el('input', { type: 'text', 'data-feld': 'name', maxlength: '80', autocomplete: 'off',
    'aria-label': 'Name' + suffix, placeholder: z ? '' : 'Name eintragen …', ...dis });
  /** @type {HTMLInputElement} */ (name).value = z ? z.name : '';
  const artikel = ARTIKEL.map((a) => {
    const label = a.label + (a.typ === 'menge' ? ' (Packungen)' : '') + suffix;
    let feld;
    if (a.typ === 'menge') {
      const opts = [];
      for (let v = 0; v <= MAX_PACKUNGEN; v++) opts.push(el('option', { value: String(v) }, [v === 0 ? '–' : String(v)]));
      feld = el('select', { 'data-feld': a.key, 'aria-label': label, ...dis }, opts);
      /** @type {HTMLSelectElement} */ (feld).value = String(z ? z[a.key] : 0);
    } else {
      feld = el('input', { type: 'checkbox', 'data-feld': a.key, 'aria-label': label, ...dis });
      /** @type {HTMLInputElement} */ (feld).checked = z ? z[a.key] === true : false;
    }
    return el('td', { 'data-label': a.kurz }, [feld]);
  });
  const inko = el('input', { type: 'text', 'data-feld': 'inko', maxlength: '80', autocomplete: 'off',
    'aria-label': 'Inkontinenzmaterial' + suffix, ...dis });
  /** @type {HTMLInputElement} */ (inko).value = z ? z.inko : '';
  const entfernen = z && !nurLesen
    ? el('button', { type: 'button', class: 'btn-icon', 'data-aktion': 'entfernen', 'aria-label': 'Zeile ' + nr + ' entfernen' }, ['×'])
    : '';
  const tr = /** @type {HTMLTableRowElement} */ (el('tr', { 'data-id': z ? z.id : '' }, [
    el('td', { class: 'sp-nr', 'data-label': 'Nr.' }, [String(nr)]),
    el('td', { class: 'sp-name', 'data-label': 'Name' }, [name]),
    ...artikel,
    el('td', { class: 'sp-inko', 'data-label': 'Inko' }, [inko]),
    el('td', { class: 'sp-budget', 'data-label': 'Budget', 'aria-live': 'polite' }, ['']),
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
  /** @type {Einstellungen|null} */
  let einst = null;
  let nurLesen = false;
  baueKopf(tabelle);

  /** @param {string} id @returns {Zeile|undefined} */
  const finde = (id) => (monat ? monat.zeilen.find((z) => z.id === id) : undefined);

  function haengeLeerzeileAn() {
    if (nurLesen || !monat || monat.zeilen.length >= MAX_ZEILEN) return;
    tbody.append(baueZeile(null, tbody.rows.length + 1, false));
  }

  /** @param {HTMLTableRowElement} tr @param {Zeile} z */
  function budgetZelle(tr, z) {
    const zelle = tr.querySelector('.sp-budget');
    if (!zelle || !einst) return;
    zelle.classList.remove('budget-ok', 'budget-ueber');
    if (!preiseHinterlegt(einst) || istLeer(z)) { zelle.textContent = '—'; return; }
    const b = budgetZeile(z, einst);
    zelle.textContent = euro(b.kostenCent) + (b.ueberschritten ? ' ⚠' : '');
    zelle.classList.add(b.ueberschritten ? 'budget-ueber' : 'budget-ok');
    zelle.setAttribute('title', (b.ueberschritten ? 'Pauschale überschritten um ' + euro(-b.restCent) : 'Rest ' + euro(b.restCent)) +
      ' (Pauschale ' + euro(b.budgetCent) + ')');
  }

  function summenZeile() {
    if (!tfoot || !monat) return;
    const s = summen(monat.zeilen);
    tfoot.replaceChildren(el('tr', {}, [
      el('th', { scope: 'row', colspan: '2', class: 'sp-name' }, ['Summe (' + s.personen + ' Pers.)']),
      ...ARTIKEL.map((a) => el('td', { 'data-label': a.kurz }, [String(s[a.key])])),
      el('td', { class: 'sp-inko', 'data-label': 'Inko' }, [s.inko ? s.inko + ' Pers.' : '–']),
      el('td', { class: 'sp-budget' }, ['']),
      el('td', { class: 'sp-aktion' }, [''])
    ]));
  }

  /** @param {Event} e */
  function beiEingabe(e) {
    const feld = /** @type {HTMLElement} */ (e.target);
    if (!monat || nurLesen || !feld.dataset || !feld.dataset.feld) return;
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
      const aktion = tr.querySelector('.sp-aktion');
      if (aktion) aktion.replaceChildren(el('button', { type: 'button', class: 'btn-icon', 'data-aktion': 'entfernen',
        'aria-label': 'Zeile ' + (tr.sectionRowIndex + 1) + ' entfernen' }, ['×']));
      haengeLeerzeileAn();
    }
    uebernimmFeld(feld, z);
    budgetZelle(tr, z);
    summenZeile();
    cb.zeileGeaendert(z);
  }

  tbody.addEventListener('input', beiEingabe);
  tbody.addEventListener('change', beiEingabe);
  tbody.addEventListener('click', (e) => {
    const btn = /** @type {HTMLElement} */ (e.target).closest('[data-aktion="entfernen"]');
    const tr = btn ? /** @type {HTMLTableRowElement|null} */ (btn.closest('tr')) : null;
    if (!tr || !tr.dataset.id || nurLesen) return;
    cb.zeileEntfernen(tr.dataset.id);
  });

  return {
    /** @param {Monat|null} m @param {Einstellungen} e @param {boolean} lesen */
    zeige(m, e, lesen) {
      monat = m; einst = e; nurLesen = lesen;
      tabelle.classList.toggle('nur-lesen', lesen);
      const zeilen = m ? m.zeilen : [];
      tbody.replaceChildren(...zeilen.map((z, i) => {
        const tr = baueZeile(z, i + 1, lesen);
        budgetZelle(tr, z);
        return tr;
      }));
      if (m) { haengeLeerzeileAn(); summenZeile(); } else if (tfoot) tfoot.replaceChildren();
    },
    leeren() {
      monat = null;
      tbody.replaceChildren();
      if (tfoot) tfoot.replaceChildren();
    }
  };
}
