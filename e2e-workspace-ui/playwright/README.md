# OneCX Playwright E2E Tests

Dieses Verzeichnis enthält Playwright E2E-Tests für die OneCX-Plattform, die in einem Docker-Container ausgeführt werden.

## Struktur

```
playwright_new/
├── harnesses/                    # Page Object Harnesses
│   ├── index.ts                  # Export aller Harnesses
│   ├── keycloak-login.harness.ts # Keycloak Login-Seite
│   └── workspace-search.harness.ts# Workspace Verwaltung
├── tests/                        # Test-Dateien
│   ├── auth.setup.ts             # Authentication Setup
│   └── workspace-management.spec.ts# Workspace Tests
├── Dockerfile.workspace          # Docker Image Definition
├── docker-entrypoint.sh          # Container Entrypoint
├── playwright.config.ts          # Playwright Konfiguration
├── package.json                  # NPM Abhängigkeiten
└── tsconfig.json                 # TypeScript Konfiguration
```

## Umgebungsvariablen

| Variable            | Beschreibung                                                                             | Default                                     |
| ------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------- |
| `BASE_URL`          | Ziel-URL der Anwendung                                                                   | `http://proxy.localhost/onecx-shell/admin/` |
| `KEYCLOAK_USER`     | Keycloak Benutzername                                                                    | `admin`                                     |
| `KEYCLOAK_PASSWORD` | Keycloak Passwort                                                                        | `admin`                                     |
| `OUTPUT_DIR`        | Verzeichnis für Test-Ergebnisse (im Container; Host: artefacts/runs/<runId>/e2e-results) | `/e2e-results`                              |
| `RUN_ID`            | Lauf-ID für Artefaktpfad auf dem Host                                                    | `local`                                     |
| `WAIT_FOR_URL`      | URL auf die gewartet werden soll (optional)                                              | -                                           |

## Docker Image bauen

```bash
cd playwright_new
docker build -f Dockerfile.workspace -t onecx-workspace-e2e:latest .
```

## Container ausführen

### Mit Host-Netzwerk (für lokale Entwicklung)

```bash
docker run --rm \
  -e BASE_URL=http://proxy.localhost/onecx-shell/admin/ \
  -e KEYCLOAK_USER=admin \
  -e KEYCLOAK_PASSWORD=admin \
  -e RUN_ID=local \
  -v $(pwd)/artefacts/runs/local/e2e-results:/e2e-results \
  --network=host \
  onecx-workspace-e2e:latest
```

### Mit Docker-Netzwerk

```bash
docker run --rm \
  -e BASE_URL=http://proxy:80/onecx-shell/admin/ \
  -e KEYCLOAK_USER=admin \
  -e KEYCLOAK_PASSWORD=admin \
  -e RUN_ID=local \
  -v $(pwd)/artefacts/runs/local/e2e-results:/e2e-results \
  --network=onecx-network \
  onecx-workspace-e2e:latest
```

### Mit Wait-For-URL

```bash
docker run --rm \
  -e BASE_URL=http://proxy.localhost/onecx-shell/admin/ \
  -e WAIT_FOR_URL=http://proxy.localhost/onecx-shell/admin/ \
  -e KEYCLOAK_USER=admin \
  -e KEYCLOAK_PASSWORD=admin \
  -e RUN_ID=local \
  -v $(pwd)/artefacts/runs/local/e2e-results:/e2e-results \
  --network=host \
  onecx-workspace-e2e:latest
```

## Ergebnisse

Nach der Ausführung werden folgende Dateien im `OUTPUT_DIR` (Standard: `artefacts/runs/<run-id>/e2e-results`) erstellt:

```
artefacts/runs/<run-id>/e2e-results/
├── .auth/
│   └── user.json                 # Gespeicherter Auth-State
├── screenshots/
│   ├── workspace-search-page.png # Vollseiten-Screenshot
│   └── workspace-header.png      # Header-Screenshot
├── test-artefacts/
│   ├── *.webm                    # Video-Aufnahmen
│   └── *.zip                     # Trace-Dateien
├── playwright-report/
│   └── index.html                # HTML Test-Report
├── test-results.json             # JSON Test-Ergebnisse
└── test-run.log                  # Ausführungs-Log
```

## Lokale Entwicklung

### Installation

```bash
npm install
npx playwright install chromium
```

### Tests lokal ausführen

```bash
# Alle Tests
npm test

# Mit Browser-UI
npm run test:headed

# Debug-Modus
npm run test:debug

# Report anzeigen
npm run test:report
```

## Harnesses

Die Harnesses sind Page Object Models, die das Finden und Interagieren mit Elementen vereinfachen:

### KeycloakLoginHarness

```typescript
import { KeycloakLoginHarness } from './harnesses'

const keycloak = new KeycloakLoginHarness(page)
await keycloak.waitForPage()
await keycloak.login('admin', 'admin')
```

### WorkspaceSearchHarness

```typescript
import { WorkspaceSearchHarness } from './harnesses'

const workspace = new WorkspaceSearchHarness(page)
await workspace.waitForPage()

// Header prüfen
const title = await workspace.getPageTitle()
const subtitle = await workspace.getPageSubtitle()

// Workspaces anzeigen
const names = await workspace.getWorkspaceNames()
const count = await workspace.getWorkspaceCardCount()
```

## Integration mit Testcontainers

Der Container ist so konzipiert, dass er mit der `E2eContainer` Klasse in `src/lib/containers/e2e/onecx-e2e.ts` verwendet werden kann:

```typescript
import { E2eContainer } from './containers/e2e/onecx-e2e'

const e2eContainer = new E2eContainer('onecx-workspace-e2e:latest')
  .withBaseUrl('http://proxy:80/onecx-shell/admin/')
  .withNetworkAliases(['workspace-e2e'])
  .enableLogging(true)

const started = await e2eContainer.start()
const exitCode = await started.getExitCode()

console.log(`E2E Tests beendet mit Exit-Code: ${exitCode}`)
```
