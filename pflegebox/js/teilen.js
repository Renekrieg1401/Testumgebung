// @ts-check
// Teilen/Herunterladen von Dateien (AERIS: exportSteuerberaterMonat).
// navigator.share wird synchron im Klick-Handler aufgerufen (transiente Nutzeraktivierung, iOS).
// Läuft die App als claude.ai-Artifact, sind <a download> und Web Share gesperrt; dort wird die
// Plattform-Funktion „downloads“ genutzt (der Nutzer bestätigt das Speichern).

/**
 * 'gespeichert' = Speichern vom Nutzer bestätigt (Artifact); 'geladen' = Browser-Download angestoßen, Abschluss unbekannt.
 * @typedef {'geteilt'|'gespeichert'|'geladen'|'abgebrochen'|'fehler'} TeilErgebnis
 * @typedef {{ save(req: { filename: string, data: Blob }): Promise<{ status: string }> }} DownloadDienst
 * @typedef {{ use(name: string): Promise<unknown> }} ClaudeLaufzeit
 */

/** @type {DownloadDienst|null} */
let dienst = null;

/** Erkennt die Artifact-Laufzeit; außerhalb von claude.ai bleibt der normale Download aktiv. */
export function erkenneDownloadDienst() {
  const laufzeit = /** @type {{ claude?: ClaudeLaufzeit }} */ (/** @type {unknown} */ (window)).claude;
  if (!laufzeit || typeof laufzeit.use !== 'function') return;
  laufzeit.use('downloads').then((ns) => {
    if (ns && typeof /** @type {DownloadDienst} */ (ns).save === 'function') dienst = /** @type {DownloadDienst} */ (ns);
  }, () => { /* nicht verfügbar — normaler Download */ });
}

/** @param {Blob} blob @param {string} dateiname */
function ankerDownload(blob, dateiname) {
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

/** @param {unknown} err @returns {TeilErgebnis} */
function saveFehler(err) {
  const code = err && typeof err === 'object' ? /** @type {{ code?: unknown }} */ (err).code : undefined;
  return code === 'declined' ? 'abgebrochen' : 'fehler';
}

/**
 * @param {Blob} blob @param {string} dateiname @returns {Promise<TeilErgebnis>}
 */
export function herunterladen(blob, dateiname) {
  if (!dienst) {
    ankerDownload(blob, dateiname);
    return Promise.resolve('geladen');
  }
  return dienst.save({ filename: dateiname, data: blob }).then(() => /** @type {TeilErgebnis} */ ('gespeichert'), saveFehler);
}

/**
 * @param {Blob} blob @param {string} dateiname @param {string} titel
 * @returns {Promise<TeilErgebnis>}
 */
export function teileOderLade(blob, dateiname, titel) {
  let datei = null;
  try { datei = new File([blob], dateiname, { type: blob.type }); } catch (_) { datei = null; }
  let kannTeilen = false;
  try {
    kannTeilen = !dienst && !!datei && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [datei] });
  } catch (_) { kannTeilen = false; }
  if (!kannTeilen || !datei) return herunterladen(blob, dateiname);
  return navigator.share({ files: [datei], title: titel }).then(
    () => /** @type {TeilErgebnis} */ ('geteilt'),
    (err) => (err instanceof Error && err.name === 'AbortError' ? /** @type {TeilErgebnis} */ ('abgebrochen') : herunterladen(blob, dateiname))
  );
}
