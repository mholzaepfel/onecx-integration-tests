# OneCX E2E Integration Test – Debug Status

Repo: `/home/maho/projects/onecx-integration-tests/onecx-integration-tests`
E2E Source: `/home/maho/projects/e2e-workspace-ui/e2e-workspace-ui/playwright`

---

## All Fixes Applied (✅ = verified in logs)

| #   | Problem                                                             | Fix                                                                            | File                                                          | Status                   |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------ |
| 1   | Keycloak `frontendUrl` `.localhost` → issuer mismatch inside Docker | `"frontendUrl": "http://keycloak-app:8080/"`                                   | `src/lib/config/realm-onecx.json` L2772                       | ✅                       |
| 2   | BASE_URL `/` → workspace-svc 404                                    | `baseUrl: http://onecx-shell-ui:8080/onecx-shell/admin/workspace`              | `integration-tests/platform/platform.json`                    | ✅                       |
| 3   | Missing bff/ui containers in platform.json                          | Added `bff[]` + `ui[]` arrays                                                  | `integration-tests/platform/platform.json`                    | ✅                       |
| 4   | v1→v2 import migration: slots as array, MFE URL used appName        | New `product-store/import-product-store.ts` with per-slot PUT + appId-hostname | `src/imports/product-store/`                                  | ✅                       |
| 5   | Import paths pointing to `-bak` dirs, wrong workspace endpoint      | Updated all paths + endpoint `/exim/v1/workspace/import`                       | `src/imports/import-manager.ts`                               | ✅                       |
| 6   | `environments` on UI containers silently ignored                    | `if (uiConfig.environments) { uiContainer.withEnvironment(...) }`              | `src/lib/platform/user-defined-container-starter.ts` L176-180 | ✅                       |
| 7   | CORS not enabled on workspace-ui                                    | `"environments": { "CORS_ENABLED": "true" }`                                   | `integration-tests/platform/platform.json` ui[]               | ✅ env reaches container |

---

## Import System v2 Migration — ABGESCHLOSSEN ✅

| Datei                                                     | Status                                          |
| --------------------------------------------------------- | ----------------------------------------------- |
| `src/imports/product-store/import-product-store.ts`       | ✅ Neu (v2: per-slot PUT, appId-Hostname)       |
| `src/imports/permissions/import-permissions.ts`           | ✅ Neu (von permissions-bak/ kopiert)           |
| `src/imports/permission-assignment/import-assignments.ts` | ✅ Neu (POST, kein Token)                       |
| `src/imports/import-manager.ts`                           | ✅ Pfade + Endpoint `/exim/v1/workspace/import` |
| `src/imports/product-store-bak/`                          | ✅ Gelöscht                                     |
| `src/imports/permissions-bak/`                            | ✅ Gelöscht                                     |
| `src/imports/assignments/`                                | ✅ Gelöscht                                     |
| `src/imports/workspace/onecx_admin.json`                  | ✅ Gelöscht (v1)                                |
| `src/imports/theme/onecx_OneCX.json`                      | ✅ Gelöscht (v1)                                |

**MFE URL-Transform (aktuell in `importMicrofrontends()`):**

```typescript
// relative URL → Docker-Hostname via appId aus Dateinamen {product}_{appid}_{mfe}.json
mfeData.remoteBaseUrl = `http://${appid}:${port}/` // z.B. http://onecx-workspace-ui:8080/
mfeData.remoteEntry = `http://${appid}:${port}/remoteEntry.js`
```

---

## Progress Per Run

| Run                  | Auth | MFE Load                 | Tests         | Problem                                                         |
| -------------------- | ---- | ------------------------ | ------------- | --------------------------------------------------------------- |
| failed-e2e.txt       | ❌   | ❌                       | 0/14          | Keycloak frontendUrl                                            |
| changed-keycloak.txt | ✅   | ❌                       | 0/14          | BASE_URL 404                                                    |
| workspace-bff-ui.txt | ✅   | ❌ remote-loading-error  | 0/14          | MFE remoteBaseUrl proxy URL                                     |
| 20260423-0902        | ✅   | ✅                       | 7/14          | CORS `OPTIONS /bff/workspaces/search → 405`                     |
| 20260423-0940        | ✅   | ❌ `/mfe/workspace/ 404` | 0/14          | shell-ui hat kein nginx-Proxy für /mfe/                         |
| 20260423-1009        | ✅   | ✅                       | 8/14          | CORS 405 weiterhin auf workspace-ui nginx                       |
| 20260423-1024        | ✅   | ✅                       | 8/14 (SIGINT) | CORS_ENABLED=true im Container ✅, nginx antwortet trotzdem 405 |

---

## Current platform.json State

```json
{
  "platformConfig": {
    "importData": true,
    "withLoggingEnabled": true,
    "heartbeat": { "enabled": true },
    "container": {
      "bff": [
        {
          "image": "ghcr.io/onecx/onecx-workspace-bff:main-native",
          "networkAlias": "onecx-workspace-bff",
          "bffDetails": { "permissionsProductName": "onecx-workspace" },
          "environments": {
            "QUARKUS_HTTP_CORS_ENABLED": "true",
            "QUARKUS_HTTP_CORS_ORIGINS": "*",
            "QUARKUS_HTTP_CORS_HEADERS": "*",
            "QUARKUS_HTTP_CORS_METHODS": "GET,HEAD,POST,PUT,DELETE,OPTIONS,PATCH"
          }
        }
      ],
      "ui": [
        {
          "image": "ghcr.io/onecx/onecx-workspace-ui:main",
          "networkAlias": "onecx-workspace-ui",
          "uiDetails": {
            "appBaseHref": "/workspace/",
            "appId": "onecx-workspace-ui",
            "productName": "onecx-workspace"
          },
          "environments": { "CORS_ENABLED": "true" }
        }
      ],
      "e2e": {
        "image": "onecx-workspace-e2e:latest",
        "networkAlias": "onecx-workspace-e2e",
        "baseUrl": "http://onecx-shell-ui:8080/onecx-shell/admin/workspace"
      }
    }
  }
}
```

---

## Active Problem: CORS — `OPTIONS /bff/* → 405` auf workspace-ui nginx

**Symptom:**

```
onecx-workspace-ui: OPTIONS /bff/workspaces/search HTTP/1.1 → 405 (559 bytes)
onecx-workspace-ui: OPTIONS /bff/menu/menuItems     HTTP/1.1 → 405 (559 bytes)
```

**Was funktioniert:**

- Auth ✅, MFE lädt ✅, Tests 1–8 (Header, Breadcrumb, Workspace page loaded) ✅
- `CORS_ENABLED=true` erreicht den Container: `Replace 'CORS_ENABLED' with 'true' in env.json` ✅

**Was fehlschlägt:**

- Tests 9–14 (DataView, Workspace-Liste, Pagination, Screenshots)
- `waitFor locator('article[aria-label^="Workspace:"]')` → timeout → keine Karten → leere Liste
- Ursache: Browser-CORS-Preflight OPTIONS wird von nginx mit 405 abgelehnt → POST /bff/workspaces/search nie ausgeführt

**Root Cause:**

- 559 Bytes Response = nginx HTML-Fehlerseite (nicht Quarkus) → OPTIONS wird nginx-seitig geblockt, nie an Quarkus weitergeleitet
- `CORS_ENABLED` scheint nginx nicht für OPTIONS-Routing zu konfigurieren

**Nächste Schritte (in Priorität):**

1. **nginx.conf im laufenden Container inspizieren:**

   ```bash
   docker exec <onecx-workspace-ui-container-id> cat /etc/nginx/conf.d/default.conf
   ```

   → Prüfen ob `/bff/` location block OPTIONS explizit blockiert oder `limit_except` fehlt

2. **Startup-Skript analysieren was CORS_ENABLED tut:**

   ```bash
   docker exec <container> find / -name "*.sh" | xargs grep -l "CORS_ENABLED"
   docker exec <container> cat /docker-entrypoint.sh
   ```

3. **Weitere Env-Vars ausprobieren:** `NGINX_CORS_ENABLED`, `CORS_ORIGINS`, `ALLOW_ORIGINS` — Image-spezifisch

4. **Alternative: workspace-ui nginx.conf überschreiben** via Docker volume mount oder Custom-Image

---

## Key Architecture Facts

| Component     | Docker hostname       | Port | Key Config                                                          |
| ------------- | --------------------- | ---- | ------------------------------------------------------------------- |
| Keycloak      | `keycloak-app`        | 8080 | `frontendUrl: http://keycloak-app:8080/` in realm-onecx.json        |
| Shell BFF     | `onecx-shell-bff`     | 8080 | `QUARKUS_OIDC_TOKEN_ISSUER=http://keycloak-app:8080/realms/onecx`   |
| Shell UI      | `onecx-shell-ui`      | 8080 | `APP_BASE_HREF=/onecx-shell/`                                       |
| Workspace BFF | `onecx-workspace-bff` | 8080 | `permissionsProductName=onecx-workspace`, CORS Quarkus-Vars gesetzt |
| Workspace UI  | `onecx-workspace-ui`  | 8080 | `APP_BASE_HREF=/workspace/`, `CORS_ENABLED=true`                    |
| E2E container | `onecx-workspace-e2e` | —    | `BASE_URL=http://onecx-shell-ui:8080/onecx-shell/admin/workspace`   |

**DOCKER_REPO:** `ghcr.io/onecx` (see `src/lib/config/env.ts`)

---

## Interface Reference (platform.json)

```typescript
// BffContainerInterface
{ image: string, networkAlias: string, bffDetails: { permissionsProductName: string }, healthCheck?: ..., environments?: Record<string,string> }

// UiContainerInterface
{ image: string, networkAlias: string, uiDetails: { appBaseHref: string, appId: string, productName: string }, environments?: Record<string,string> }

// E2eContainerInterface
{ image: string, networkAlias: string, baseUrl: string }
```

---

## Noise to Ignore

- `Failed to export TraceRequestMarshaler ... Connection refused: localhost/127.0.0.1:4317` → OpenTelemetry, harmless
- `GET /v1/themes/OneCX/favicon [404]` → kein favicon, harmless
- `GET /bff/images/ADMIN/logo failed (No such file or directory)` → kein Logo-Asset, harmless
- `GET /styles.css failed (No such file or directory)` → Shell-UI missing asset, harmless
- `POST http://onecx-parameter-svc:8080/bff/v1/parameters [404]` → parameter-svc nicht im Stack, harmless

---

## OLD CONTENT BELOW (preserved for reference)

| --- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------ |
| 1 | Keycloak `frontendUrl` used `.localhost` hostname → tokens had unresolvable issuer inside Docker | Changed `"frontendUrl"` from `http://keycloak-app.localhost:8080` → `http://keycloak-app:8080/` | `src/lib/config/realm-onecx.json` line 2772 | ✅ Confirmed |
| 2 | E2E BASE_URL pointed to shell root `/` → `workspace-svc` returned 404 for path `/` | Changed `baseUrl` from `http://onecx-shell-ui:8080/onecx-shell/` → `http://onecx-shell-ui:8080/onecx-shell/admin/workspace` | `integration-tests/platform/platform.json` | ✅ Confirmed |
| 3 | `platform.json` had no bff/ui entries for workspace app (invalid syntax) | Added proper `bff[]` and `ui[]` arrays for `onecx-workspace-bff` and `onecx-workspace-ui` | `integration-tests/platform/platform.json` | ✅ Confirmed |

---

## Current platform.json State (working)

```json
{
  "platformConfig": {
    "importData": true,
    "withLoggingEnabled": true,
    "heartbeat": { "enabled": true },
    "container": {
      "bff": [
        {
          "image": "ghcr.io/onecx/onecx-workspace-bff:main-native",
          "networkAlias": "onecx-workspace-bff",
          "bffDetails": { "permissionsProductName": "onecx-workspace" }
        }
      ],
      "ui": [
        {
          "image": "ghcr.io/onecx/onecx-workspace-ui:main",
          "networkAlias": "onecx-workspace-ui",
          "uiDetails": { "appBaseHref": "/workspace/", "appId": "onecx-workspace-ui", "productName": "onecx-workspace" }
        }
      ],
      "e2e": {
        "image": "onecx-workspace-e2e:latest",
        "networkAlias": "onecx-workspace-e2e",
        "baseUrl": "http://onecx-shell-ui:8080/onecx-shell/admin/workspace"
      }
    }
  }
}
```

---

## Progress Per Run

| Run                                  | Auth               | workspace-svc /admin/workspace | workspaceConfig | MFE Load             |
| ------------------------------------ | ------------------ | ------------------------------ | --------------- | -------------------- |
| failed-e2e.txt                       | ❌ chrome-error:// | ❌ path `/` 404                | ❌              | ❌                   |
| failed-e2e-with-changed-keycloak.txt | ✅                 | ❌ path `/` 404                | ❌              | ❌                   |
| failed-e2e-with-workspace-bff-ui.txt | ✅                 | ✅ 200                         | ✅ 200          | ❌ MFE loading error |

---

## Active Problem: MFE Remote Loading Fails

**Symptom (from last log):**

```
Shell navigates to: /onecx-shell/remote-loading-error-page;requestedApplicationPath=%2Fadmin%2Fworkspace
onecx-workspace-e2e: ❌ Workspace page could not be loaded
```

**What succeeds before the failure:**

- `POST /workspaceConfig [200]` → shell gets correct workspace config for `/admin/workspace`
- `POST /v1/permissions/user/onecx-workspace/onecx-workspace-ui [200]` → permissions OK
- Shell resolves MFE for `/admin/workspace` → tries to load `onecx-workspace-ui` Module Federation remote

**Root cause hypothesis:**
The `remoteBaseUrl` stored in the product store for `onecx-workspace-ui` MFEs points to a URL not reachable from Chrome inside Docker. In docker-compose, this is usually configured via an environment variable at deploy time; in Testcontainers, the imported data has a hardcoded URL.

**Investigation needed — NEXT STEPS IN ORDER:**

1. Read `remoteBaseUrl` in these product-store import files:

   - `src/imports/product-store/onecx-workspace_onecx-workspace-ui_main.json`
   - `src/imports/product-store/onecx-workspace_onecx-workspace-ui_footer-menu.json`
   - (and other `onecx-workspace_onecx-workspace-ui_*.json` — footer-menu, horizontal-main-menu, user-avatar-menu, user-sidebar-menu, vertical-main-menu)
   - If `remoteBaseUrl` = `http://proxy.localhost/workspace/` or similar → update ALL of them to `http://onecx-workspace-ui:8080`

2. Check shell-ui nginx config: does it proxy `/workspace/` → `onecx-workspace-ui:8080`?

   - If YES: `remoteBaseUrl` can use `http://onecx-shell-ui:8080/workspace/`
   - If NO: `remoteBaseUrl` must point directly to `http://onecx-workspace-ui:8080`

3. Check `workspace-management.spec.ts` line ~29 in `/home/maho/projects/e2e-workspace-ui/e2e-workspace-ui/playwright/tests/`:
   - Line reads: `page.goto(\`${baseUrl}admin\`)`
   - With `BASE_URL=http://onecx-shell-ui:8080/onecx-shell/admin/workspace` this navigates to `.../admin/workspaceadmin` (wrong)
   - Fix: Either set `BASE_URL=http://onecx-shell-ui:8080/onecx-shell/admin/` (trailing slash, no path) and keep `admin` suffix
   - OR: remove the `admin` suffix from `goto()` call if base URL already includes the path

---

## Key Architecture Facts

| Component     | Docker network hostname | Port | Note                                                                   |
| ------------- | ----------------------- | ---- | ---------------------------------------------------------------------- |
| Keycloak      | `keycloak-app`          | 8080 | `realm-onecx.json` frontendUrl = `http://keycloak-app:8080/`           |
| Shell BFF     | `onecx-shell-bff`       | 8080 | Sets `QUARKUS_OIDC_TOKEN_ISSUER=http://keycloak-app:8080/realms/onecx` |
| Shell UI      | `onecx-shell-ui`        | 8080 | `APP_BASE_HREF=/onecx-shell/`, `KEYCLOAK_URL=http://keycloak-app:8080` |
| Workspace BFF | `onecx-workspace-bff`   | 8080 | `permissionsProductName=onecx-workspace`                               |
| Workspace UI  | `onecx-workspace-ui`    | 8080 | `APP_BASE_HREF=/workspace/`, `PRODUCT_NAME=onecx-workspace`            |
| E2E container | `onecx-workspace-e2e`   | -    | Chrome runs INSIDE Docker network                                      |

**IMPORTANT**: `DOCKER_REPO = ghcr.io/onecx` (see `src/lib/config/env.ts`)

**Workspace import**: `src/imports/workspace/onecx_admin.json` → workspace name `admin`, `baseUrl: /admin`, contains products/MFEs for the admin workspace.

**auth.setup.ts**: navigates to `BASE_URL`, waits for Keycloak, logs in (user: `onecx`, pass: `onecx`), waits for `!url.includes('/realms/')`.

**workspace-management.spec.ts**: `page.goto(\`${baseUrl}admin\`)`→ with`BASE_URL=http://onecx-shell-ui:8080/onecx-shell/admin/workspace`this navigates to`…/admin/workspaceadmin` (!). Check if this is intentional or a bug in the test.

---

## Interface Reference (for platform.json authoring)

```typescript
// BffContainerInterface
{ image: string, networkAlias: string, bffDetails: { permissionsProductName: string }, healthCheck?: ..., environments?: ... }

// UiContainerInterface
{ image: string, networkAlias: string, uiDetails: { appBaseHref: string, appId: string, productName: string }, environments?: ... }

// E2eContainerInterface
{ image: string, networkAlias: string, baseUrl: string }
```

---

## Noise to Ignore

- `Failed to export TraceRequestMarshaler ... Connection refused: localhost/127.0.0.1:4317` → OpenTelemetry not configured, harmless
- `GET /v1/themes/OneCX/favicon [404]` → no favicon uploaded, harmless
- `POST http://onecx-parameter-svc:8080/bff/v1/parameters [404]` → parameter-svc not in stack, harmless
