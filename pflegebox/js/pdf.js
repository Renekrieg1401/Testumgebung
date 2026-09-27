// @ts-check
// Minimaler, abhängigkeitsfreier PDF-1.4-Schreiber (Vektor-Text/-Linien, Standardschriften Helvetica/
// Helvetica-Bold mit WinAnsiEncoding). Ersetzt html2canvas + jsPDF:
// kein CDN, voll offlinefähig, synchron (Teilen bleibt im Klick-Gesten-Kontext), scharfer Druck.

const W_REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const W_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];

/** Unicode → WinAnsi (cp1252) für Zeichen außerhalb von Latin-1. */
const WIN_ANSI = /** @type {Readonly<Record<string, number>>} */ (Object.freeze({
  '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94,
  '•': 0x95, '–': 0x96, '—': 0x97, '−': 0x2d
}));
/** Breiten der Sonderzeichen (1/1000 em), für beide Schnitte hinreichend gleich. */
const W_SONDER = /** @type {Readonly<Record<number, number>>} */ (Object.freeze({
  0x80: 556, 0x82: 222, 0x84: 333, 0x85: 1000, 0x91: 222, 0x92: 222, 0x93: 333, 0x94: 333, 0x95: 350,
  0x96: 556, 0x97: 1000, 0xa0: 278, 0xa7: 556, 0xa9: 737, 0xae: 737, 0xb0: 400, 0xb2: 333, 0xb3: 333,
  0xb5: 556, 0xb7: 278, 0xbc: 834, 0xbd: 834, 0xbe: 834, 0xc6: 1000, 0xd7: 584, 0xd8: 778, 0xdf: 611,
  0xe6: 889, 0xf7: 584, 0xf8: 611
}));

/** @param {string} s @returns {number[]} */
export function winAnsi(s) {
  /** @type {number[]} */
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0) || 0x3f;
    if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff)) out.push(c);
    else out.push(WIN_ANSI[ch] !== undefined ? WIN_ANSI[ch] : 0x3f);
  }
  return out;
}

/** @param {number} code @param {boolean} fett */
function zeichenBreite(code, fett) {
  if (code >= 0x20 && code <= 0x7e) return (fett ? W_BOLD : W_REG)[code - 0x20];
  const sonder = W_SONDER[code];
  if (sonder !== undefined) return sonder;
  if (code >= 0xc0) {
    const basis = String.fromCharCode(code).normalize('NFD').charCodeAt(0);
    if (basis >= 0x20 && basis <= 0x7e) return (fett ? W_BOLD : W_REG)[basis - 0x20];
  }
  return 556;
}

/** @param {string} s @param {number} groesse @param {boolean} fett @returns {number} Breite in pt */
export function textBreite(s, groesse, fett) {
  return winAnsi(s).reduce((sum, c) => sum + zeichenBreite(c, fett), 0) * groesse / 1000;
}

/** Kürzt Text mit „…“ auf die Maximalbreite. @param {string} s @param {number} max @param {number} groesse @param {boolean} fett */
export function passeEin(s, max, groesse, fett) {
  if (textBreite(s, groesse, fett) <= max) return s;
  const zeichen = Array.from(s);
  while (zeichen.length > 0 && textBreite(zeichen.join('') + '…', groesse, fett) > max) zeichen.pop();
  return zeichen.join('') + '…';
}

/** @param {number[]} codes @returns {string} PDF-Literal (reines ASCII, Nicht-ASCII oktal) */
function literal(codes) {
  let s = '(';
  codes.forEach((c) => {
    if (c === 0x28 || c === 0x29 || c === 0x5c) s += '\\' + String.fromCharCode(c);
    else if (c < 0x20 || c > 0x7e) s += '\\' + c.toString(8).padStart(3, '0');
    else s += String.fromCharCode(c);
  });
  return s + ')';
}

/** @param {string} hex @returns {string} */
function farbe(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(' ');
}

/** @param {number} n */
function f(n) { return (Math.round(n * 100) / 100).toString(); }

/**
 * Gemeinsame Zeichenschnittstelle für PDF (Vektor) und Canvas (JPG). Koordinaten in pt, Ursprung oben links.
 * @typedef {{
 *   seite: () => void,
 *   text: (x: number, y: number, s: string, opt?: TextOpt) => void,
 *   rechteck: (x: number, y: number, w: number, h: number, opt: RechteckOpt) => void,
 *   linie: (x1: number, y1: number, x2: number, y2: number, hex: string, staerke: number) => void
 * }} Zeichenflaeche
 */

/**
 * @typedef {{ groesse?: number, fett?: boolean, farbe?: string, ausrichtung?: 'links'|'mitte'|'rechts' }} TextOpt
 * @typedef {{ fuellung?: string, rand?: string, randBreite?: number }} RechteckOpt
 */

/**
 * Seitenkoordinaten: Ursprung oben links, Einheit pt (1/72 Zoll).
 * @param {number} breite @param {number} hoehe
 */
export function neuesDokument(breite, hoehe) {
  /** @type {string[][]} */
  const seiten = [];
  /** @type {string[]} */
  let aktuell = [];

  function seite() { aktuell = []; seiten.push(aktuell); }

  /** @param {number} x @param {number} y @param {string} s @param {TextOpt} [opt] */
  function text(x, y, s, opt) {
    const o = opt || {};
    const g = o.groesse || 10;
    const fett = !!o.fett;
    let tx = x;
    if (o.ausrichtung === 'mitte') tx = x - textBreite(s, g, fett) / 2;
    if (o.ausrichtung === 'rechts') tx = x - textBreite(s, g, fett);
    aktuell.push('BT /' + (fett ? 'F2' : 'F1') + ' ' + f(g) + ' Tf ' + farbe(o.farbe || '#000000') + ' rg ' +
      f(tx) + ' ' + f(hoehe - y) + ' Td ' + literal(winAnsi(s)) + ' Tj ET');
  }

  /** @param {number} x @param {number} y @param {number} w @param {number} h @param {RechteckOpt} opt */
  function rechteck(x, y, w, h, opt) {
    const ops = ['q'];
    if (opt.fuellung) ops.push(farbe(opt.fuellung) + ' rg');
    if (opt.rand) ops.push(farbe(opt.rand) + ' RG ' + f(opt.randBreite || 0.5) + ' w');
    ops.push(f(x) + ' ' + f(hoehe - y - h) + ' ' + f(w) + ' ' + f(h) + ' re');
    ops.push(opt.fuellung && opt.rand ? 'B' : opt.fuellung ? 'f' : 'S', 'Q');
    aktuell.push(ops.join(' '));
  }

  /** @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {string} hex @param {number} staerke */
  function linie(x1, y1, x2, y2, hex, staerke) {
    aktuell.push('q ' + farbe(hex) + ' RG ' + f(staerke) + ' w ' + f(x1) + ' ' + f(hoehe - y1) + ' m ' +
      f(x2) + ' ' + f(hoehe - y2) + ' l S Q');
  }

  /** @param {string} titel @param {Date} zeit @returns {Uint8Array<ArrayBuffer>} */
  function bytes(titel, zeit) {
    /** @type {string[]} */
    const teile = [];
    /** @type {number[]} */
    const offsets = [];
    let laenge = 0;
    /** @param {string} t */
    const push = (t) => { teile.push(t); laenge += t.length; };
    /** @param {number} nr @param {string} kopf @param {string} [strom] */
    const obj = (nr, kopf, strom) => {
      offsets[nr] = laenge;
      if (strom === undefined) { push(nr + ' 0 obj\n' + kopf + '\nendobj\n'); return; }
      push(nr + ' 0 obj\n' + kopf + '\nstream\n');
      push(strom);
      push('\nendstream\nendobj\n');
    };
    push('%PDF-1.4\n%âãÏÓ\n');
    const ersteSeite = 5;
    const kids = seiten.map((_, i) => (ersteSeite + i * 2) + ' 0 R').join(' ');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [' + kids + '] /Count ' + seiten.length + ' >>');
    obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const ressourcen = '<< /Font << /F1 3 0 R /F2 4 0 R >> >>';
    seiten.forEach((ops, i) => {
      const nr = ersteSeite + i * 2;
      const inhalt = ops.join('\n');
      obj(nr, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + f(breite) + ' ' + f(hoehe) + '] /Resources ' + ressourcen +
        ' /Contents ' + (nr + 1) + ' 0 R >>');
      obj(nr + 1, '<< /Length ' + inhalt.length + ' >>', inhalt);
    });
    const infoNr = ersteSeite + seiten.length * 2;
    const d = zeit.toISOString().replace(/[-:T]/g, '').slice(0, 14);
    obj(infoNr, '<< /Title ' + literal(winAnsi(titel)) + ' /Producer (PflegeBox) /CreationDate (D:' + d + 'Z) >>');
    const xrefStart = laenge;
    let xref = 'xref\n0 ' + (infoNr + 1) + '\n0000000000 65535 f \n';
    for (let n = 1; n <= infoNr; n++) xref += String(offsets[n]).padStart(10, '0') + ' 00000 n \n';
    push(xref + 'trailer\n<< /Size ' + (infoNr + 1) + ' /Root 1 0 R /Info ' + infoNr + ' 0 R >>\nstartxref\n' + xrefStart + '\n%%EOF\n');
    const out = new Uint8Array(laenge);
    let pos = 0;
    teile.forEach((t) => {
      for (let k = 0; k < t.length; k++) out[pos + k] = t.charCodeAt(k) & 0xff;
      pos += t.length;
    });
    return out;
  }

  seite();
  return { seite, text, rechteck, linie, bytes, breite, hoehe, /** @returns {number} */ get seitenzahl() { return seiten.length; } };
}

/** @typedef {ReturnType<typeof neuesDokument>} PdfDokument */
