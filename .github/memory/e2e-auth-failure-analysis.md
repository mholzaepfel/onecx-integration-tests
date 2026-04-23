# E2E Auth-Failure — Root Cause & Fix (2026-04-15)

> **Agent-Kurzfassung:**  
> E2E-Auth schlägt fehl weil `realm-onecx.json` einen `frontendUrl` mit `.localhost`-Domain hat,  
> der den Keycloak-Issuer für Tokens ändert. Innerhalb des Docker-Netzwerks ist dieser Hostname  
> nicht auflösbar → `chrome-error://chromewebdata/` nach Login.  
> **Fix: `frontendUrl` in `src/lib/config/realm-onecx.json` (Zeile 2772) auf `""` setzen.**

---

## Betroffene Dateien

| Datei                                      | Problem                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| `src/lib/config/realm-onecx.json` Z. 2772  | `"frontendUrl": "http://keycloak-app.localhost:8080"` → falsch für Docker-Netzwerk |
| `integration-tests/platform/platform.json` | `baseUrl` im E2E-Container (sekundär, kein Blocker)                                |

---

## Root Cause

In `src/lib/config/realm-onecx.json` Z. 2772:

```json
"frontendUrl": "http://keycloak-app.localhost:8080"
```

Keycloak setzt diesen Wert als Issuer in ausgestellten Tokens. Die Shell-UI erwartet aber `http://keycloak-app:8080` als Issuer (gesetzt über `KC_HOSTNAME_URL` des Keycloak-Containers und `QUARKUS_OIDC_TOKEN_ISSUER` der Shell). Der Issuer-Mismatch bricht die Token-Validierung. Der anschließende Auth-Retry navigiert zu `keycloak-app.localhost:8080` — einem im Docker-Netz nicht auflösbaren Hostnamen — was `chrome-error://chromewebdata/` erzeugt.

---

## Issuer-Konflikt auf einen Blick

| Quelle                                          | Issuer-Wert                                       |
| ----------------------------------------------- | ------------------------------------------------- |
| Token (aus Realm `frontendUrl`)                 | `http://keycloak-app.localhost:8080/realms/onecx` |
| Shell-UI erwartet (`QUARKUS_OIDC_TOKEN_ISSUER`) | `http://keycloak-app:8080/realms/onecx`           |

---

## Getestete BASE_URL Varianten

| BASE_URL                                                                              | Ergebnis                        |
| ------------------------------------------------------------------------------------- | ------------------------------- |
| `http://onecx.localhost/onecx-shell/admin/workspace` (docker-compose, --network=host) | ✅ 14/14                        |
| `http://onecx-shell-ui:8080/onecx-shell/`                                             | ❌ `chrome-error://` nach Login |
| `http://onecx-shell-ui:8080/onecx-shell/admin/workspace`                              | ❌ `chrome-error://` nach Login |
| `http://onecx-shell-ui:8080/`                                                         | ❌ Kein Keycloak-Gate ausgelöst |

> Die BASE_URL selbst ist korrekt erreichbar (curl 200). Der Fehler liegt **nach** dem Login, nicht beim Routing.

---

## Fix

### Option A — Empfohlen: `frontendUrl` leeren

Datei: `src/lib/config/realm-onecx.json`, Z. 2772

```json
// vorher
"frontendUrl": "http://keycloak-app.localhost:8080"

// nachher
"frontendUrl": ""
```

Keycloak verwendet dann `KC_HOSTNAME_URL = http://keycloak-app:8080` → Issuer stimmt überein.

### Option B — `frontendUrl` auf Docker-Hostname setzen

```json
"frontendUrl": "http://keycloak-app:8080"
```

Funktioniert für Testcontainers-Runs, bricht aber docker-compose-Setups mit `.localhost`-Domain.

---

## Richtige BASE_URL für Testcontainers-Kontext

```
http://onecx-shell-ui:8080/onecx-shell/admin/workspace
```

- Hostname `onecx-shell-ui` im Docker-Netz auflösbar ✅
- Prefix `/onecx-shell/` stimmt mit `withAppBaseHref('/onecx-shell/')` überein ✅
- Geschützte Route löst Keycloak-Auth aus ✅
- **Nur wirksam nach dem `frontendUrl`-Fix** ✅
  | Fehler 3 | `http://onecx-shell-ui:8080/` | `http://onecx-shell-ui:8080/` | ❌ `Keycloak login not required on initial navigation` (Shell lädt ohne Auth-Gate) |

**Wichtig:** Die BASE_URL selbst ist erreichbar (nginx bestätigt `200 OK` auf curl-Check), das Problem liegt **nach** dem Login.

---

## Symptome im Fehlerfall

```
[Auth Setup] Keycloak login page detected
[Auth Setup] Performing login...
[Auth Setup] Redirect successful, URL: chrome-error://chromewebdata/
[Auth Setup] OAuth code processed
[Auth Setup] Login successful, final URL: chrome-error://chromewebdata/
[Auth Setup] Authentication failed: Error: Authentication state is invalid
  - still redirected to Keycloak: http://keycloak-app:8080/realms/onecx/...
```

Der Browser (Chromium in Playwright) landet nach dem Keycloak-Login **nicht** auf der Shell-App, sondern auf einer Chrome-Fehlerseite. Danach wiederholt die Shell den kompletten Auth-Flow.

---

## Ursachen-Analyse

### Primärursache — Realm `frontendUrl` Mismatch

In `src/lib/config/realm-onecx.json` (Zeile 2772):

```json
"frontendUrl": "http://keycloak-app.localhost:8080"
```

Gleichzeitig wird der Keycloak-Container gestartet mit:

```typescript
// src/lib/containers/core/onecx-keycloak.ts
KC_HOSTNAME_URL: `http://keycloak-app:8080`
KC_HOSTNAME_STRICT: 'false'
```

**In Keycloak überschreibt ein `frontendUrl` auf Realm-Ebene den systemweiten `KC_HOSTNAME_URL` für diesen spezifischen Realm** (betrifft: Issuer-URLs in Tokens, OIDC Discovery-Dokument).

Das Discovery-Dokument liefert daher:

```json
{ "issuer": "http://keycloak-app.localhost:8080/realms/onecx" }
```

Die Shell-UI ist aber konfiguriert mit:

```typescript
// src/lib/containers/ui/onecx-shell-ui.ts
KEYCLOAK_URL: `http://keycloak-app:8080`
// src/lib/utils/common-env.utils.ts
QUARKUS_OIDC_TOKEN_ISSUER: `http://keycloak-app:8080/realms/onecx`
```

**Issuer-Konflikt:**
| Quelle | Issuer |
|--------|--------|
| Realm-Konfiguration (frontendUrl) | `http://keycloak-app.localhost:8080/realms/onecx` |
| Container-Konfiguration (KC_HOSTNAME_URL) | `http://keycloak-app:8080/realms/onecx` |
| Shell-UI / Token-Validation erwartet | `http://keycloak-app:8080/realms/onecx` |

### Ablauf des Fehlers (Schritt für Schritt)

1. Browser navigiert zu `http://onecx-shell-ui:8080/onecx-shell/` → ✅ Shell lädt
2. Angular Shell liest Keycloak-Konfiguration, initiiert OIDC-Redirect → ✅
3. Browser öffnet `http://keycloak-app:8080/realms/onecx/...` (Auth-Endpoint) → ✅ Login-Seite erscheint
4. Credentials eingegeben, Login geklickt → ✅ Keycloak authentifiziert
5. Keycloak redirectet zurück zu `redirect_uri=http://onecx-shell-ui:8080/onecx-shell/#code=…` → ✅
6. Angular verarbeitet `code`, tauscht ihn gegen Token (POST zu Token-Endpoint) → ✅ Token erhalten
7. Angular validiert Token-`iss`-Claim: `http://keycloak-app.localhost:8080/realms/onecx` ≠ erwartet → ❌ **Validierung schlägt fehl**
8. Angular leitet Browser zurück zu Keycloak für neuen Auth-Versuch  
   → diesmal mit dem `.localhost`-Hostnamen aus dem Discovery-Dokument  
   → `http://keycloak-app.localhost:8080/...` ist von **innerhalb des Docker-Netzwerks nicht auflösbar**  
   → Browser-Fehler: `chrome-error://chromewebdata/`
9. Da `chrome-error://...` keine `/realms/`-Zeichenfolge enthält, beendet `waitForURL` erfolgreich  
   → Playwright meldet fälschlicherweise "Login successful"
10. Nachfolgende URL-Prüfung zeigt: Browser ist **wieder auf Keycloak** (`keycloak-app:8080`) → Auth-Fehler

### Warum klappt es mit docker-compose / --network=host?

- BASE_URL und Shell-UI nutzen `onecx.localhost` (resolves auf `127.0.0.1` auf dem Host)
- Keycloak-URL: `keycloak-app.localhost:8080` (resolves ebenfalls auf Host-Netzwerk)
- Realm-`frontendUrl` (`http://keycloak-app.localhost:8080`) **stimmt überein** mit dem Hostnamen, über den Keycloak tatsächlich erreichbar ist
- Kein Hostname-Mismatch → Token-Validierung erfolgreich

---

## Fix-Optionen

### Option A — Primärfix: `frontendUrl` aus Realm entfernen (Empfehlung)

In `src/lib/config/realm-onecx.json` das Feld `frontendUrl` entfernen oder leer lassen:

```json
// Zeile 2772 — ändern:
"frontendUrl": ""
```

Dann übernimmt Keycloak den Wert von `KC_HOSTNAME_URL` = `http://keycloak-app:8080` für alle Realm-URLs. Das passt zum Shell-UI-Setup.

### Option B — Realm `frontendUrl` auf Docker-Hostname setzen

```json
"frontendUrl": "http://keycloak-app:8080"
```

Konsistent mit `KC_HOSTNAME_URL`. Nachteil: realm-onecx.json bricht dann für docker-compose-Setups mit `.localhost`-Domain.

### Option C — Keycloak mit `KC_HOSTNAME_STRICT=true` starten

Dann ignoriert Keycloak die Realm-`frontendUrl` vollständig und erzwingt den systemweiten Hostname. Aber Vorsicht: das könnte andere Stellen beeinflussen.

### Option D — Realm frontendUrl dynamisch beim Container-Start überschreiben

Nach Keycloak-Start per Admin-API die Realm-`frontendUrl` auf `http://keycloak-app:8080` setzen. Aufwändig, aber nicht-invasiv für den Realm-JSON.

---

## BASE_URL-Fazit für `platform.json`

Die `baseUrl` im E2E-Container muss auf eine Route zeigen, die:

1. Im Docker-Netzwerk erreichbar ist (`onecx-shell-ui` als Hostname ✅)
2. Das `/onecx-shell/`-Prefix enthält (wegen `withAppBaseHref('/onecx-shell/')` im Shell-UI-Container ✅)
3. Zu einer geschützten Route zeigt, die Keycloak-Auth auslöst

Für dieses Projekt: **`http://onecx-shell-ui:8080/onecx-shell/admin/workspace`** ist die funktionale Entsprechung zur docker-compose-URL `http://onecx.localhost/onecx-shell/admin/workspace`.

Aber: Die BASE_URL allein reicht nicht — ohne den `frontendUrl`-Fix bleibt der Auth immer fehlerhaft.

---

## Zusammenfassung

> **Das Problem liegt nicht in der BASE_URL, sondern im Keycloak-Realm.**  
> Die importierte `realm-onecx.json` enthält `"frontendUrl": "http://keycloak-app.localhost:8080"`.  
> Dieser Wert überschreibt `KC_HOSTNAME_URL` für die Token-Issuer-URL.  
> Innerhalb des Docker-Netzwerks ist `keycloak-app.localhost` nicht auflösbar.  
> Die OIDC-Token-Validierung schlägt fehl, weil Issuer-Claim ≠ erwarteter Issuer.  
> Der Browser landet auf `chrome-error://chromewebdata/`, weil die folgende Auth-Retry-URL nicht erreichbar ist.

**Minimaler Fix:** In `realm-onecx.json` die `frontendUrl` auf `""` oder `"http://keycloak-app:8080"` setzen.
