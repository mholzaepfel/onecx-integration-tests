# Shell v3 adaptation: Web Crypto API / HTTPS issue

Migrating the e2e tests to **shell v3** surfaced a chain of auth failures that didn't exist
before. All of them trace back to one root cause and were resolved with one coordinated fix.
This document captures the problem and the step-by-step resolution.

## Problem

`auth.setup.ts` never reached Keycloak's login form. It timed out after 30s waiting for
`#kc-form-login`, silently fell into the "already logged in" catch block, and saved an
**empty/unauthenticated** auth state. Every downstream test then failed waiting for app content
that never loaded, because the browser never actually completed login.

Direct console capture showed the real error:
```
Error: Web Crypto API is not available.
    at ... W.createLoginUrl (.../onecx-shell/22528....js:1:19975)
```

### Root cause

`createLoginUrl` is `keycloak-js` building the OIDC redirect URL using **PKCE S256**, which
requires `window.crypto.subtle.digest(...)`. Browsers only expose `crypto.subtle` in a **secure
context** (`https://`, or `http://` on `localhost`). The e2e container's Playwright browser
navigated to plain `http://onecx-shell-ui:8080/...`, which is not a secure context, so
`crypto.subtle` was `undefined` and `keycloak-js` threw before ever redirecting to Keycloak.

PKCE S256 is hard-required by the realm config
(`integration-tests/testing/test-realm/realm-onecx.json` → `"pkce.code.challenge.method": "S256"`),
so it can't be relaxed — the environment had to become a secure context instead.

### Dead ends ruled out first

- **`*.localhost` baseUrl** — no Traefik/reverse-proxy container exists in this platform, so
  Chromium resolves `*.localhost` to its own loopback, not the Docker network. Nothing listens
  there: `ERR_CONNECTION_REFUSED`.
- **`--unsafely-treat-insecure-origin-as-secure` Chromium flag** — the standard flag for this
  exact problem, but never got a conclusive clean run (no diagnostic logging at the time), and
  the e2e image has to be rebuilt for `playwright.config.ts` changes to take effect, which wasn't
  done consistently. Abandoned in favor of a definitive fix: real HTTPS.
- **Keycloak version pin (23.0.4)** — the secure-context restriction is pure browser policy,
  unrelated to the auth server version. Reverted; didn't address the cause.

## Solution: give the shell a real secure context, then fix what broke as a result

### Step 1 — HTTPS on the shell UI

Generated a self-signed TLS cert for `onecx-shell-ui` and added an nginx `8443 ssl` listener
to the shell UI container, reverse-proxying to its own existing `127.0.0.1:8080`.
**Why:** the page the browser loads must be a secure context for `crypto.subtle` to exist —
this is the direct fix for the Web Crypto error.

Updated `platform.json`'s e2e `baseUrl` to `https://onecx-shell-ui:8443/...` so Playwright
actually navigates to the new secure origin.

**Checkpoint:** Web Crypto error gone. New error: *Mixed Content* — the now-https shell page
blocked its own XHR call to `http://keycloak-app:8080/.../token` (`keycloak-js` talks to
Keycloak directly from the browser, not proxied through the shell).

### Step 2 — HTTPS on Keycloak

Generated a self-signed cert for `keycloak-app` and enabled Keycloak's native HTTPS support
(`KC_HTTPS_CERTIFICATE_FILE`/`KEY_FILE`, `KC_HTTPS_PORT=8443`), keeping `8080` plain-http
available for everything else still calling Keycloak internally.
Pointed `KEYCLOAK_URL` (shell + workspace UI) at `https://keycloak-app:8443`.
**Why:** an https page cannot make plain-http XHR/fetch calls — Keycloak needed to be https too
since the browser calls it directly.

**Checkpoint:** Mixed-content error gone. New error: `401 Unauthorized` on backend calls like
`/workspaceConfig` and `/userProfile`.

### Step 3 — Pin Keycloak's issuer identity

Replaced legacy `KC_HOSTNAME_URL`/`KC_HOSTNAME_STRICT` with `KC_HOSTNAME=https://keycloak-app:8443`
+ `KC_HOSTNAME_BACKCHANNEL_DYNAMIC=true`.
**Why:** with two reachable ports (8080 http, 8443 https), Keycloak's `iss` (issuer) claim varied
depending on which port a request came through, so browser-obtained and backend-validated tokens
disagreed on issuer. Pinning `KC_HOSTNAME` fixes the `iss` claim to one https identity everywhere,
while `BACKCHANNEL_DYNAMIC` still lets backend services reach discovery/JWKS over plain http.

### Step 4 — Fix the backend's hardcoded expected issuer

Updated the shared `QUARKUS_OIDC_TOKEN_ISSUER` env (used by every `BffContainer`/`SvcContainer`)
from `http://keycloak-app:8080/realms/...` to `https://<keycloak-network-alias>:8443/realms/...`,
deriving the hostname from `keycloakContainer.getNetworkAliases()[0]` — the same source already
used for `QUARKUS_OIDC_AUTH_SERVER_URL` on the line above — instead of hardcoding `keycloak-app`.
**Why:** Quarkus OIDC validates a token's `iss` claim against this static value — it doesn't
pick it up dynamically from Keycloak's discovery document, so Step 3 alone wasn't enough.
Deriving the hostname keeps this correct even if the Keycloak container's network alias is ever
changed via `withEnvironmentHostname(...)`.

**Checkpoint:** no more `401`s or issuer-mismatch warnings. `permission`, `workspace load`,
`product-store load`, and `userProfile` all return `200`.

### Step 5 — Fix MFE manifest URL rewriting

`importMicrofrontends`'s Docker-network URL rewrite hardcoded the result to end in
`remoteEntry.js`, discarding the real filename. Changed it to reuse the original entry's
filename instead.
**Why:** shell v3 MFEs (including `onecx-shell` and this app) are served via
`mf-manifest.json`, not `remoteEntry.js` — the hardcoded rewrite was silently turning a working
manifest URL into a 404.

### Step 6 — HTTPS + CORS on every MFE's own UI container

Moved the TLS + reverse-proxy setup from Step 1 into the **shared `UiContainer` base class**
(used by shell, workspace, and any app registered via `container.ui[]`), so every UI container
gets an `8443` TLS listener and `CORS_ENABLED: 'true'` automatically. Removed the shell's
one-off hand-rolled TLS block to avoid double-listening on `8443`. Updated the MFE import
rewrite to point at `https://<appid>:8443/...` to match.
**Why:** once the shell itself was https, every cross-origin MFE manifest/asset fetch (including
this app's own UI container) was blocked twice over — as mixed content and as CORS — since
plain-http UI containers had neither TLS nor CORS headers. Applying the fix once at the base
class covers all current and future apps with no per-app patching.

**Checkpoint:** no more mixed-content/CORS errors loading MFE manifests or assets.

## Status

| Issue | Status |
|---|---|
| Web Crypto API unavailable | Fixed |
| Mixed content on Keycloak calls | Fixed |
| 401 / issuer mismatch on backend calls | Fixed |
| MFE import rewriting `mf-manifest.json` to `remoteEntry.js` | Fixed |
| Mixed content / CORS on MFE manifest and asset loading | Fixed |

**Outstanding:** drop the now-likely-unnecessary `--allow-running-insecure-content` Chromium
flag, and decide whether globally-slotted apps with no backing container (`onecx-help-ui`,
`onecx-theme-ui`) need real containers or should be pruned from the catalog.
