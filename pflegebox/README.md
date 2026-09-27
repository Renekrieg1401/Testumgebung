# PflegeBox 2 — Bestellformular Pflegehilfsmittel

Optimierte Fassung von [`Bestellschein-pflegebox`](https://github.com/Renekrieg1401/Bestellschein-pflegebox)
mit der Speicher- und Dokumentlogik aus **AERIS Doku/Finanz** (`aeris-app-finanz`).
Reine clientseitige PWA: kein Backend, kein CDN, keine Anmeldung, voll offlinefähig.

## Übernommene AERIS-Logik

| AERIS (`app.js`) | PflegeBox | Datei |
|---|---|---|
| Datenschicht `persist`/`aeApplyMigrations` | localStorage, Schema v2, Normalisierung jedes geladenen/wiederhergestellten Bestands, automatisches Speichern | `js/store.js`, `js/model.js` |
| Einmal-Umzug des Altbestands | Bestellschein v1 (`bestellschein_aktuell`) wird beim ersten Start übernommen und erst nach erfolgreichem Speichern entfernt | `js/store.js`, `js/model.js` |
| Briefkopf / Druckexport | Vektor-PDF bzw. JPG mit Briefkopf (Besteller/Lieferant), Summenzeile, Seitenzahlen; Teilen oder Download | `js/bestellung.js`, `js/pdf.js`, `js/leinwand.js`, `js/teilen.js` |
| `pruefeAufUpdate` + Network-First-SW | Versionsquelle `<meta name="app-version">`, SW-Cache je Version | `js/update.js`, `sw.js` |

## Weitere Optimierungen gegenüber v1

- **PDF ohne html2canvas/jsPDF**: eigener PDF-1.4-Schreiber (Helvetica, WinAnsi). Scharfer Vektordruck,
  wenige KB statt Rasterbild, synchron → „PDF senden / teilen“ in **einem** Tipp (vorher zwei Schritte).
- **Monatsarchiv** statt eines einzigen Blatts; Navigation ‹ Monat ›, Übernahme von Personen (optional mit Mengen) aus dem Vormonat.
- **Dynamische Zeilen** (automatische Leerzeile, max. 60) statt starrer 16 Zeilen.
- **Responsive** statt `transform: scale()`: Tabelle ab Tablet, Kartenansicht auf dem Handy; WCAG 2.1 AA
  (Beschriftungen je Feld, 44-px-Ziele, Fokusrahmen, native `<dialog>`-Modale, Skip-Link, `prefers-reduced-motion`).
- **Content-Security-Policy** ohne Inline-Skripte, keine Fremd-Domains.
- **Download als PDF oder JPG** (JPG: alle Seiten untereinander, ≈ 144 dpi).
- **Personen per ＋ hinzufügen, per − entfernen**; sofortiges Speichern jeder Eingabe; im claude.ai-Artifact zusätzlich privat im Konto gespiegelt (`js/spiegel.js`).
- **Update-Overlay** beim Öffnen, sobald eine neuere `app-version` veröffentlicht ist.

## Entwicklung

```bash
cd pflegebox
npm install
npm run typecheck   # tsc --strict --checkJs über alle Module + Service Worker
npm test            # Unit-Tests (Modell, Migration, Speicher, PDF-Parsing via pdf.js)
npm run e2e         # Chromium-E2E: Migration, Eingabe, PDF/JPG, Monatsübernahme, Offline
node tools/server.mjs   # lokaler Server auf http://127.0.0.1:8080/
```

Die App ist direkt als statische Seite auslieferbar (GitHub Pages: Ordnerinhalt ins Repo-Wurzelverzeichnis).
Bei jedem Release `app-version` in `index.html` erhöhen; neue Module zusätzlich in `APP_SHELL` in `sw.js` eintragen.

## Datenschutz

Namen und Bestellungen sind Gesundheitsdaten (Art. 9 DSGVO). Sie liegen unverschlüsselt im Browser-Speicher dieses
Geräts (keine Anmeldung, keine Sperre) und verlassen es nur durch aktives Teilen/Herunterladen. Das Gerät selbst
sollte daher per Bildschirmsperre geschützt sein.
