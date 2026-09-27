# PflegeBox 2 — Bestellformular Pflegehilfsmittel

Optimierte Fassung von [`Bestellschein-pflegebox`](https://github.com/Renekrieg1401/Bestellschein-pflegebox)
mit der Speicher-, Sicherheits- und Belegelogik aus **AERIS Doku/Finanz** (`aeris-app-finanz`).
Reine clientseitige PWA: kein Backend, kein CDN, voll offlinefähig.

## Übernommene AERIS-Logik

| AERIS (`app.js`) | PflegeBox | Datei |
|---|---|---|
| PIN-Gate `aePinGateStart` (setup/unlock/migrate/relock) | PIN 6–8 Ziffern, Hintergrund `inert`, Sperre nach 60 s im Hintergrund + Sichtschutz-Blur, manuelle Sperre | `js/gate.js` |
| AES-GCM + PBKDF2, `aePersistQueue` | AES-256-GCM (AAD), PBKDF2-SHA-256 mit 600 000 Iterationen (im Umschlag gespeichert), serialisierte Schreibwarteschlange | `js/crypto.js`, `js/store.js` |
| Migration mit Rück-Entschlüsselungsprobe | Klartext-Altbestand `bestellschein_aktuell` wird verschlüsselt übernommen, erst danach gelöscht | `js/store.js`, `js/model.js` |
| `aeApplyMigrations` | Schema v2 + Normalisierung jedes entschlüsselten/importierten Bestands | `js/model.js` |
| `getOrAssignRechnungsnr` | Bestell-Nr. `BS-<Jahr>-<lfd.>`, einmalig je Monat, stabil | `js/model.js` |
| Tages-/Monatsfreigabe mit `openSig` | Versiegeln mit Unterschrift (Canvas, JPEG, DPR ≤ 2), Schreibschutz, Entsiegeln nur protokolliert | `js/signatur.js`, `js/model.js` |
| `buildSteuerberaterCsv` | Monats-CSV (BOM, `;`, CRLF) inkl. Budgetspalten, zusätzlich Schutz vor Formel-Injection | `js/csv.js` |
| `berechneBudgetZahlenFuer` | Budgetprüfung je Person gegen Pauschale § 40 Abs. 2 SGB XI (Standard 42,00 €, einstellbar); Inkontinenzmaterial (SGB V) nicht angerechnet | `js/model.js`, `js/tabelle.js` |
| Briefkopf / `aeOpenPrintFragment` | Vektor-PDF mit Briefkopf (Besteller/Lieferant), Summenzeile, Unterschrift, Seitenzahlen; Öffnen im neuen Tab (iOS-Standalone) | `js/bestellung-pdf.js`, `js/teilen.js` |
| `pruefeAufUpdate` + Network-First-SW | Versionsquelle `<meta name="app-version">`, SW-Cache je Version | `js/update.js`, `sw.js` |
| `updateStorageIndicator` | Speicherstand in den Einstellungen | `js/einstellungen.js` |

## Weitere Optimierungen gegenüber v1

- **PDF ohne html2canvas/jsPDF**: eigener PDF-1.4-Schreiber (Helvetica, WinAnsi, DCTDecode). Scharfer Vektordruck,
  wenige KB statt Rasterbild, synchron → „PDF senden / teilen“ in **einem** Tipp (vorher zwei Schritte).
- **Monatsarchiv** statt eines einzigen Blatts; Navigation ‹ Monat ›, Übernahme von Personen (optional mit Mengen) aus dem Vormonat.
- **Dynamische Zeilen** (automatische Leerzeile, max. 60) statt starrer 16 Zeilen.
- **Responsive** statt `transform: scale()`: Tabelle ab Tablet, Kartenansicht auf dem Handy; WCAG 2.1 AA
  (Beschriftungen je Feld, 44-px-Ziele, Fokusrahmen, native `<dialog>`-Modale, Skip-Link, `prefers-reduced-motion`).
- **Content-Security-Policy** ohne Inline-Skripte, keine Fremd-Domains.
- **Verschlüsselte Datensicherung** (Export/Import) für Gerätewechsel.

## Entwicklung

```bash
cd pflegebox
npm install
npm run typecheck   # tsc --strict --checkJs über alle Module + Service Worker
npm test            # Unit-Tests (Modell, Migration, Tresor, CSV, PDF-Parsing via pdf.js)
npm run e2e         # Chromium-E2E: Migration, Eingabe, Verschlüsselung, Budget, PDF/CSV, Versiegeln, Offline
node tools/server.mjs   # lokaler Server auf http://127.0.0.1:8080/
```

Die App ist direkt als statische Seite auslieferbar (GitHub Pages: Ordnerinhalt ins Repo-Wurzelverzeichnis).
Bei jedem Release `app-version` in `index.html` erhöhen; neue Module zusätzlich in `APP_SHELL` in `sw.js` eintragen.

## Datenschutz

Namen und Bestellungen sind Gesundheitsdaten (Art. 9 DSGVO). Sie verlassen das Gerät nur durch aktives Teilen/Exportieren.
Ohne PIN ist keine Wiederherstellung möglich (kein Master-Passwort). Hinweis: Eine 6–8-stellige PIN schützt gegen
Zugriff über die Oberfläche; gegen ein vollständiges Auslesen des Geräts bietet sie nur begrenzten Schutz.
