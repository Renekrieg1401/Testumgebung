// @ts-check
// Monats-CSV (AERIS: buildSteuerberaterCsv) — BOM, Semikolon, CRLF, Excel-tauglich.
// Zusätzlich Schutz vor CSV-/Formel-Injection (Zellen, die mit = + - @ Tab CR beginnen).

import { ARTIKEL, budgetZeile, euro, istLeer, menge, preiseHinterlegt, summen, ymText } from './model.js';

/** @param {string|number} v @returns {string} */
export function csvZelle(v) {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

/**
 * @param {import('./model.js').Daten} d @param {string} ym @param {import('./model.js').Monat} m @param {Date} jetzt
 * @returns {string}
 */
export function erzeugeMonatsCsv(d, ym, m, jetzt) {
  const e = d.einstellungen;
  const mitPreisen = preiseHinterlegt(e);
  const zeilen = m.zeilen.filter((z) => !istLeer(z));
  /** @type {string[]} */
  const out = [];
  /** @param {...(string|number)} werte */
  const zeile = (...werte) => { out.push(werte.map(csvZelle).join(';')); };

  zeile('PflegeBox — Bestellübersicht Pflegehilfsmittel');
  zeile('Monat', ymText(ym));
  zeile('Bestell-Nr.', m.bestellnr || 'noch nicht vergeben');
  zeile('Status', m.status === 'versiegelt' ? 'versiegelt' : 'Entwurf');
  if (m.siegel) zeile('Unterschrieben', m.siegel.name, new Date(m.siegel.zeit).toLocaleString('de-DE'));
  zeile('Besteller', e.absender.name, e.absender.strasse, e.absender.ort);
  zeile('Lieferant', e.lieferant.name, e.lieferant.kundennr, e.lieferant.email);
  zeile('Erzeugt am', jetzt.toLocaleString('de-DE'));
  zeile('');

  const kopf = ['Nr.', 'Name', ...ARTIKEL.map((a) => a.label + (a.typ === 'menge' ? ' (Packungen)' : ' (Packung)')), 'Inkontinenz (SGB V)'];
  if (mitPreisen) kopf.push('Kosten § 40 Abs. 2 SGB XI', 'Pauschale', 'Rest', 'Pauschale überschritten');
  zeile(...kopf);
  zeilen.forEach((z, i) => {
    const werte = [String(i + 1), z.name, ...ARTIKEL.map((a) => String(menge(z, a.key))), z.inko];
    if (mitPreisen) {
      const b = budgetZeile(z, e);
      werte.push(euro(b.kostenCent), euro(b.budgetCent), euro(b.restCent), b.ueberschritten ? 'ja' : 'nein');
    }
    zeile(...werte);
  });
  const s = summen(zeilen);
  const summe = ['', 'Summe (' + s.personen + ' Personen)', ...ARTIKEL.map((a) => String(s[a.key])), s.inko + ' Personen'];
  if (mitPreisen) {
    const gesamt = zeilen.reduce((acc, z) => acc + budgetZeile(z, e).kostenCent, 0);
    summe.push(euro(gesamt), euro(e.budgetCent * s.personen), euro(e.budgetCent * s.personen - gesamt), '');
  }
  zeile(...summe);
  zeile('');
  zeile('Hinweis: Enthält personenbezogene Gesundheitsdaten (Art. 9 DSGVO). Nur an berechtigte Empfänger weitergeben.');
  return '﻿' + out.join('\r\n') + '\r\n';
}
