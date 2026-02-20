# Copilot Instructions — UI Platform Integration Tests (TypeScript + Testcontainers + Playwright)

## 1) What this repository is for

This repository provides the **central integration-test runner** for a UI platform consisting of a **Shell** and multiple **Core Apps**.  
The runner is consumed by UI repositories through a **GitHub Actions reusable workflow**:
`org/integration-tests/.github/workflows/integration-tests.yml@<ref>`.

Core goals:

- Verify that a **Shell version** runs with the **latest released** versions of all Core Apps.
- Verify that an **App version** runs with the **latest released** version of the Shell (and latest released other apps).
- Support **PR**, **scheduled nightly**, **on-demand**, and **local** runs with reproducible version resolution.

Tech stack:

- TypeScript (strict) for orchestration and tooling.
- Testcontainers to start platform services.
- Playwright E2E runs via an **E2E container definition** coming from UI repositories.

## 2) Terminology (must be used consistently)

- **latest version**: latest **released** product version.
- **main version**: latest build from **main branch** (including release candidates).
- **PR version**: latest build from the PR branch.
- **local version**: version from the currently checked-out repository.
- **specified version**: explicitly pinned ref (tag/SHA/branch).

Never reinterpret “latest” as “main”.

## 3) Run matrix (what must be supported)

### Scheduled (nightly)

Shell:

- main Shell + latest Apps (detect Shell UI changes breaking released UIs)
- main Shell + main Apps (validate next-release constellation)

Apps:

- main App + latest Shell + latest other Apps (detect integration breaks from App changes)

### On-demand

Shell:

- latest Shell + latest Apps (validate released constellation)
- specified Shell + specified Apps (defaults to latest if not provided; per-app artifact override)

### Pull Request

Shell:

- PR Shell + latest Apps
  Apps:
- PR App + latest Shell + latest other Apps

### Local

Shell:

- local Shell + latest Apps
  Apps:
- local App + latest Shell + latest other Apps
  Both:
- optional parameters to override versions/images of specific artifacts.

## 4) Caller repository contract (critical)

Calling UI repositories define E2E and platform startup **inside the caller repo**:

- `/integration/platform.json`
- `/integration/e2e/**`

The reusable workflow in this repo MUST:

1. Ensure the caller repo is checked out into `$GITHUB_WORKSPACE`.
2. Read and validate `integration/platform.json` and the `integration/e2e` folder from the **caller** workspace.
3. Use these definitions to start the platform and then run Playwright E2E via the E2E container.

Do not hardcode app lists; derive behavior from `platform.json` and validate required keys.

## 5) Platform config model (authoritative concepts)

`platform.json` describes:

- optional flags (e.g., importData, withLoggingEnabled)
- heartbeat/health-check settings
- image overrides (core/services/bff/ui) for testing different images
- container definitions (service/bff/ui/e2e)

Use typed interfaces (e.g., PlatformConfig and container interfaces) at the boundaries:

- parse JSON -> validate -> typed object.
  Fail fast with actionable error messages when required config is missing/invalid.

## 6) Reusable GitHub Actions workflow requirements

The integration-tests repo MUST ship a reusable workflow at:

- `.github/workflows/integration-tests.yml`
- with `on: workflow_call` so it can be consumed cross-repo.

### Workflow inputs (defaults must be sensible)

Provide inputs that allow caller repos to keep their YAML minimal:

- `integrationRoot` (default: `integration`)
- `platformConfigPath` (default: `integration/platform.json`)
- `e2eDir` (default: `integration/e2e`)
- `mode` and `target` (scheduled/on-demand/pr/local; shell/app)
- version selectors (latest/main/pr/local/specified) + per-artifact overrides when relevant
- runtime config (node version, timeouts, retries)

### Workflow outputs & artifacts

Always produce and upload:

- JUnit report
- JSON report containing resolved versions/images + provenance + metadata
- human-readable job summary
  Return key outputs (e.g., report artifact name, resolved versions JSON) via workflow outputs.

### Checkout rules (caller repo vs this repo)

By default, `actions/checkout` checks out a repository into `$GITHUB_WORKSPACE`.
Because this workflow must read `/integration/**` from the caller repo, ensure the caller is available in the workspace.  
If the orchestration code lives in this repository (integration-tests), either:

- distribute it as an npm package and install it in the job, OR
- perform an additional checkout of this repo into a subfolder using `repository:` + `path:`.

## 7) Architecture principles (enforce separation)

Separate concerns into testable modules:

- Version resolution (latest/main/pr/local/specified)
- Artifact/image resolution (tags, registries, overrides)
- Environment bootstrap (Testcontainers)
- E2E execution (Playwright container)
- Reporting + notifications

Every run must be reproducible:

- log final resolved versions/images and their provenance (latest/main/pr/local/specified).

## 8) Versioning & “latest” tag semantics

Assumptions that must be enforced:

- `latest` maps to the **last product release** for Shell/App.
- For multi-artifact components (svc/ui/bff), `latest` must reflect the last product release for each artifact.
  If tags are missing or ambiguous, fail with a clear message:
- what is missing,
- where it was expected,
- how to fix it (e.g., publish/retag).

## 9) TypeScript + Testcontainers guidance

- Use TypeScript strict typing, explicit types at boundaries (CLI/workflow inputs/config parsing).
- Ensure containers are always cleaned up (finally/afterAll).
- Make timeouts/retries configurable to reduce flakiness.
- Prefer structured logs (JSON) plus concise human summaries.

## 10) Local execution requirements

Enable a consistent local entry point (e.g., package.json script):

- `npm run integration:test` (or equivalent)
  Local and CI runs must share the same underlying runner implementation.

## 11) How Copilot should respond (format and behavior)

When asked to change or extend the codebase:

1. Start with a short plan (max 8 bullets).
2. List concrete file changes (paths + rationale).
3. Provide small, reviewable patches and avoid guessing conventions.
4. Ask targeted questions if critical details are unknown (registry naming, required secrets, exact E2E config files).
5. Never change the meaning of “latest” or the run-matrix rules above.
