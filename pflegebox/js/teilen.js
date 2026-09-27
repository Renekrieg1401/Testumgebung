// @ts-check
// Teilen/Herunterladen/Öffnen von Dateien (AERIS: exportSteuerberaterMonat + aeOpenPrintFragment).
// navigator.share wird synchron im Klick-Handler aufgerufen (transiente Nutzeraktivierung, iOS).

/**
 * @param {Blob} blob @param {string} dateiname
 */
export function herunterladen(blob, dateiname) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * @param {Blob} blob @param {string} dateiname @param {string} titel
 * @returns {Promise<'geteilt'|'geladen'|'abgebrochen'>}
 */
export function teileOderLade(blob, dateiname, titel) {
  let datei = null;
  try { datei = new File([blob], dateiname, { type: blob.type }); } catch (_) { datei = null; }
  let kannTeilen = false;
  try {
    kannTeilen = !!datei && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [datei] });
  } catch (_) { kannTeilen = false; }
  if (!kannTeilen || !datei) {
    herunterladen(blob, dateiname);
    return Promise.resolve('geladen');
  }
  return navigator.share({ files: [datei], title: titel }).then(
    () => /** @type {'geteilt'} */ ('geteilt'),
    (err) => {
      if (err instanceof Error && err.name === 'AbortError') return /** @type {'abgebrochen'} */ ('abgebrochen');
      herunterladen(blob, dateiname);
      return /** @type {'geladen'} */ ('geladen');
    }
  );
}

/**
 * Öffnet die Datei in neuem Tab (auch in iOS-Standalone-PWAs druckbar); Popup-Blocker → Download.
 * @param {Blob} blob @param {string} dateiname @returns {'geoeffnet'|'geladen'}
 */
export function oeffneInTab(blob, dateiname) {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  if (win) return 'geoeffnet';
  herunterladen(blob, dateiname);
  return 'geladen';
}
