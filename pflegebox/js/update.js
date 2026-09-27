// @ts-check
// Service-Worker-Registrierung + Update-Overlay beim Öffnen (AERIS: pruefeAufUpdate mit APP-VERSION).
// Einzige Versionsquelle: <meta name="app-version"> in index.html; der Service Worker erhält sie als
// Query-Parameter (neue Version ⇒ neue SW-URL ⇒ neuer Cache, alte Caches werden verworfen).

/** @param {Document} doc @returns {string} */
export function appVersion(doc) {
  const meta = doc.querySelector('meta[name="app-version"]');
  return meta ? meta.getAttribute('content') || '' : '';
}

/** @param {string} html @returns {string|null} */
export function versionAusHtml(html) {
  const m = /<meta\s+name="app-version"\s+content="([\w.-]+)"/.exec(html);
  return m ? m[1] : null;
}

/** @param {string} version */
export function registriereServiceWorker(version) {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  navigator.serviceWorker.register('sw.js?v=' + encodeURIComponent(version)).catch(() => {
    /* Ohne SW bleibt die App online voll funktionsfähig. */
  });
}

/**
 * @param {string} version @param {(neu: string) => void} beiNeuerVersion
 */
export function starteUpdatePruefung(version, beiNeuerVersion) {
  let gemeldet = false;
  const pruefe = () => {
    if (gemeldet || !navigator.onLine || !location.protocol.startsWith('http')) return;
    fetch(location.pathname + '?v=' + Date.now(), { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : ''))
      .then((html) => {
        const neu = versionAusHtml(html);
        if (neu && neu !== version) { gemeldet = true; beiNeuerVersion(neu); }
      })
      .catch(() => { /* offline — nächster Versuch beim nächsten Intervall */ });
  };
  pruefe();
  window.setInterval(pruefe, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pruefe(); });
}

const WECHSEL_TIMEOUT_MS = 5000;

/**
 * Aktiviert zuerst den Service Worker der neuen Version (er holt alle Dateien am HTTP-Cache vorbei neu)
 * und lädt erst danach die Seite neu — sonst könnten zwischengespeicherte alte Programmteile zur neuen
 * Seite geladen werden. Ohne Service Worker oder bei Zeitüberschreitung wird direkt neu geladen.
 * @param {string} neu @returns {Promise<void>}
 */
export function aktiviereNeueVersion(neu) {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return Promise.resolve();
  return new Promise((resolve) => {
    const fertig = () => { window.clearTimeout(timer); resolve(); };
    const timer = window.setTimeout(fertig, WECHSEL_TIMEOUT_MS);
    navigator.serviceWorker.addEventListener('controllerchange', fertig, { once: true });
    navigator.serviceWorker.register('sw.js?v=' + encodeURIComponent(neu)).then((reg) => {
      if (reg.active && !reg.installing && !reg.waiting && navigator.serviceWorker.controller &&
        navigator.serviceWorker.controller.scriptURL === reg.active.scriptURL) fertig();
    }, fertig);
  });
}
