// @ts-check
// Unterschriften-Pad (AERIS: openSig/sigSetupCanvas) auf <canvas> mit Pointer-Events.
// Backing-Store auf max. 2× DPR gedeckelt, Export als JPEG 0.85 (einfarbige Strichzeichnung,
// kleiner als PNG und direkt per DCTDecode ins PDF einbettbar).

/**
 * @param {HTMLCanvasElement} canvas
 */
export function erzeugeSignaturPad(canvas) {
  const ctx = canvas.getContext('2d');
  let zeichnet = false;
  let inhalt = false;

  function vorbereiten() {
    if (!ctx) return;
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, r.width, r.height);
    ctx.strokeStyle = '#1a2536';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    inhalt = false;
  }

  /** @param {PointerEvent} e */
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!ctx) return;
    zeichnet = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
    inhalt = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* Capture optional */ }
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!zeichnet || !ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    e.preventDefault();
  });
  const stopp = () => { zeichnet = false; };
  canvas.addEventListener('pointerup', stopp);
  canvas.addEventListener('pointercancel', stopp);
  canvas.addEventListener('pointerleave', stopp);

  return {
    vorbereiten,
    leeren: vorbereiten,
    /** @returns {boolean} */ hatInhalt: () => inhalt,
    /** @returns {string} */ alsJpeg: () => canvas.toDataURL('image/jpeg', 0.85)
  };
}
