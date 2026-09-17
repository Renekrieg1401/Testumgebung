# AERIS

Digitale Pflegeanwendung (DiPA, § 78a SGB XI) für pflegende Angehörige.
Zero-Knowledge-Architektur: sensible Daten werden ausschließlich clientseitig
verschlüsselt: erzeugt und verarbeitet. Der Server sieht ausnahmslos opake
Ciphertexte.

## Struktur (Nx-integrierbares Monorepo)

```
apps/
  aeris-api/   Fastify-Backend, node:sqlite, RFC-7807-Fehlerantworten
  aeris-web/   Next.js-PWA, offline-first (RxDB/IndexedDB)
libs/
  crypto-core/     Zero-Knowledge-Verschlüsselungskern (DEK/KEK, Argon2id, AES-256-GCM)
  shared-schemas/  Zod-Schemata, RFC-7807-Problem-Details, Sync-Konfliktauflösung
  fhir-export/     FHIR-R4-Export (QuestionnaireResponse)
```

Jedes Projekt trägt ein `project.json` (Tags `scope:*`/`type:*`) und ein eigenes
`tsconfig.json`; Pfad-Aliase (`@aeris/*`) sind in `tsconfig.base.json` definiert.
`nx.json` ist vorbereitet — die Projekte laufen aktuell über npm-Workspaces und
`tsx`/Next direkt auf dem TypeScript-Quellcode (kein separater dist-Build nötig).

## Zero-Knowledge-Sicherheitsmodell

- **DEK** (Data-Encryption-Key): zufällig, 256 Bit, AES-256-GCM.
- **KEK** (Key-Encryption-Key): aus der Passphrase via Argon2id abgeleitet
  (`@noble/hashes`, isomorph Browser/Node, keine Native-Bindings).
- Der DEK wird mit dem KEK gewrappt (AES-256-GCM) und nur in dieser Form
  (`VaultEnvelope`: Salt, KDF-Parameter, gewrappter DEK) persistiert/übertragen.
- Einzelne Felder (Assessment-Antworten) werden mit dem DEK ver-/entschlüsselt
  (`encryptField`/`decryptField`). Die Passphrase verlässt den Client nie.
- Der Server (`aeris-api`) speichert ausschließlich Ciphertext-Envelopes;
  kein Klartext-Logging sensibler Felder.

## Offline-First & Synchronisation

- Lokaler Store im Browser: RxDB mit Dexie-Storage (IndexedDB).
- Sync-Strategie **pro Entität** dokumentiert in
  `libs/shared-schemas/src/assessment.schema.ts`: Assessments nutzen
  Last-Write-Wins mit Vektoruhr — bei echter Nebenläufigkeit entscheidet der
  Zeitstempel, sonst die kausale Ordnung. Die Auflösung ist deterministisch
  und läuft identisch auf Client und Server (`resolveAssessmentConflict`).
- Push/Pull ist Best-Effort: Sync-Fehler blockieren die App nicht
  (`syncPending()` holt offene Einträge beim nächsten Onlinegang nach).

## Scope dieser Iteration (bewusste Grenzen)

- Ein Beispiel-Assessment ("Kurz-Belastungscheck", 3 Items) demonstriert den
  vollen Zero-Knowledge-Flow inkl. FHIR-R4-Export — kein vollständiger
  Fragebogenkatalog.
- Kontenmodell ist ein clientseitig erzeugtes, opakes `accountId` (UUID) ohne
  weitere Authentifizierung. Eine produktionsreife DiPA benötigt zusätzlich
  ein Auth-/Identitätsverfahren (z. B. TAN-Verfahren nach § 78a SGB XI) —
  außerhalb dieser Iteration.
- `node:sqlite` ist experimentell (Node ≥ 22.5); für Produktion ggf. gegen
  eine stabile Persistenzschicht austauschen.

## Entwicklung

```bash
npm install
npm run typecheck      # alle Projekte
npm run test           # alle Vitest-Suiten (24 Tests)
npm run lint           # ESLint strict + type-aware, repo-weit

npm run dev:api        # Fastify auf :3333
npm run dev:web        # Next.js PWA auf :3000
```

`AERIS_CORS_ORIGINS` (API) und `NEXT_PUBLIC_AERIS_API_URL` (Web) sind für
abweichende Ports/Hosts konfigurierbar.
