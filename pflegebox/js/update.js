// @ts-check
// Service-Worker-Registrierung + sichtbarer Update-Hinweis (AERIS: pruefeAufUpdate mit APP-VERSION).
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
 * @param {string} version @param {() => void} beiNeuerVersion
 */
export function starteUpdatePruefung(version, beiNeuerVersion) {
  let gemeldet = false;
  const pruefe = () => {
    if (gemeldet || !navigator.onLine || !location.protocol.startsWith('http')) return;
    fetch(location.pathname + '?v=' + Date.now(), { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : ''))
      .then((html) => {
        const neu = versionAusHtml(html);
        if (neu && neu !== version) { gemeldet = true; beiNeuerVersion(); }
      })
      .catch(() => { /* offline — nächster Versuch beim nächsten Intervall */ });
  };
  window.setTimeout(pruefe, 1500);
  window.setInterval(pruefe, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pruefe(); });
}
