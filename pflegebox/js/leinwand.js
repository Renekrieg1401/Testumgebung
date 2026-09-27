// @ts-check
// Canvas-Zeichenfläche mit derselben Schnittstelle wie der PDF-Schreiber (für den JPG-Export).
// Arial/Liberation Sans sind metrisch kompatibel zu Helvetica, das Layout passt daher 1:1.

const SCHRIFT = 'Helvetica, Arial, "Liberation Sans", sans-serif';
const SEITEN_ABSTAND = 24;

/**
 * @typedef {import('./pdf.js').TextOpt} TextOpt
 * @typedef {import('./pdf.js').RechteckOpt} RechteckOpt
 */

/** @param {string} b64 @returns {Uint8Array<ArrayBuffer>} */
function ausB64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** @param {HTMLCanvasElement} c @returns {CanvasRenderingContext2D} */
function kontext(c) {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas wird von diesem Browser nicht unterstützt.');
  return ctx;
}

/** @param {number} breite @param {number} hoehe @param {number} skala */
export function neueLeinwand(breite, hoehe, skala) {
  /** @type {HTMLCanvasElement[]} */
  const seiten = [];
  /** @type {CanvasRenderingContext2D} */
  let ctx;

  function seite() {
    const c = document.createElement('canvas');
    c.width = Math.round(breite * skala);
    c.height = Math.round(hoehe * skala);
    ctx = kontext(c);
    ctx.scale(skala, skala);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, breite, hoehe);
    seiten.push(c);
  }

  /** @param {number} x @param {number} y @param {string} s @param {TextOpt} [opt] */
  function text(x, y, s, opt) {
    const o = opt || {};
    ctx.font = (o.fett ? 'bold ' : '') + (o.groesse || 10) + 'px ' + SCHRIFT;
    ctx.fillStyle = o.farbe || '#000000';
    ctx.textAlign = o.ausrichtung === 'mitte' ? 'center' : o.ausrichtung === 'rechts' ? 'right' : 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(s, x, y);
  }

  /** @param {number} x @param {number} y @param {number} w @param {number} h @param {RechteckOpt} opt */
  function rechteck(x, y, w, h, opt) {
    if (opt.fuellung) { ctx.fillStyle = opt.fuellung; ctx.fillRect(x, y, w, h); }
    if (opt.rand) { ctx.strokeStyle = opt.rand; ctx.lineWidth = opt.randBreite || 0.5; ctx.strokeRect(x, y, w, h); }
  }

  /** @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {string} hex @param {number} staerke */
  function linie(x1, y1, x2, y2, hex, staerke) {
    ctx.strokeStyle = hex;
    ctx.lineWidth = staerke;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  /** Alle Seiten untereinander als ein JPG. @param {number} qualitaet @returns {Uint8Array<ArrayBuffer>} */
  function jpeg(qualitaet) {
    const abstand = Math.round(SEITEN_ABSTAND * skala);
    const gesamt = document.createElement('canvas');
    gesamt.width = seiten[0].width;
    gesamt.height = seiten.reduce((h, c) => h + c.height, 0) + abstand * (seiten.length - 1);
    const g = kontext(gesamt);
    g.fillStyle = '#d0d4d9';
    g.fillRect(0, 0, gesamt.width, gesamt.height);
    let y = 0;
    seiten.forEach((c) => { g.drawImage(c, 0, y); y += c.height + abstand; });
    const url = gesamt.toDataURL('image/jpeg', qualitaet);
    return ausB64(url.slice(url.indexOf(',') + 1));
  }

  seite();
  return { seite, text, rechteck, linie, jpeg };
}
