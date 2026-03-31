# Copilot Instructions — UI Platform Integration Tests (TypeScript + Testcontainers + Playwright)

## 1) Quick Start

**What:** Central integration-test runner for OneCX Shell + Core Apps. Consumed by UI repos via reusable workflow at `org/integration-tests/.github/workflows/integration-tests.yml`.

**Who:** Test engineers, platform developers, CI maintainers in UI repositories.

**Core goals:** Verify Shell and App versions run with correct upstream versions (latest/main/PR/local/specified). Support reproducible runs in local, CI, and scheduled contexts.

**Tech stack:** TypeScript (strict) → Testcontainers → Docker → Playwright E2E.

## 2) Key Terminology

Use consistently. Never reinterpret "latest" as "main":

| Term | Definition |
|------|------------|
| **latest** | Last product release (released artifact) |
| **main** | Latest build from main branch (includes RC) |
| **PR** | Latest build from pull request branch |
| **local** | Currently checked-out repository version |
| **specified** | Explicitly pinned ref (tag/SHA/branch) |

## 3) Repository Boundaries

### Caller Contract (Critical)

UI repositories provide **inside their own repo**:
- `/integration/platform.json` — Platform stack configuration
- `/integration/e2e/**` — Playwright E2E definitions

This repo's reusable workflow MUST:
1. Ensure caller repo is available in `$GITHUB_WORKSPACE`
2. Read and validate caller's `platform.json` and `e2e/` folder
3. Use those definitions to bootstrap platform and run E2E

**Do NOT** hardcode app lists; derive behavior from `platform.json`.

### Run Matrix (What Must Work)

| Context | Shell | Apps |
|---------|-------|------|
| **Scheduled** | main + latest | main + latest, main + main |
| **On-Demand** | latest, specified | latest (all), specified (per-app override) |
| **Pull Request** | PR + latest | PR + latest (shell + other) |
| **Local** | local + latest | local + latest (shell + other) |

### Architecture Principles

Separate concerns into testable modules:
- Version resolution → Artifact resolution → Environment bootstrap → E2E execution → Reporting

Every run must be reproducible: **log resolved versions/images and their provenance.**

## 4) How Copilot Should Respond

When asked to change or extend the codebase:

1. **Start** with a short plan (max 8 bullets, bullet points only).
2. **List** concrete file changes (paths + one-line rationale).
3. **Implement** with small, reviewable patches—don't guess conventions.
4. **Ask** targeted questions if critical details are unknown (registry, secrets, exact config files).
5. **Protect** non-negotiables: Never change "latest" semantics or run-matrix rules.
6. **Be concise** in explanations; use tables and bullets over prose.
7. **Link** specific line numbers and file paths for context.

## 5) Platform Config & Contracts

### PlatformConfig Structure

`platform.json` describes:

| Field | Type | Purpose |
|-------|------|---------|
| `importData` | boolean | Run data import after service startup |
| `withLoggingEnabled` | boolean \| string[] | Enable logging globally or per-container |
| `heartbeat` | HeartbeatConfig | Health check interval, thresholds, enabled flag |
| `platformOverrides` | object | Override image tags for core/services/bff/ui |
| `container` | object | User-defined service/bff/ui/e2e containers |

**Validation rule:** Parse JSON → validate schema → fail fast with actionable error (what's missing, where, how to fix).

### GitHub Actions Reusable Workflow

Must ship at: `.github/workflows/integration-tests.yml` with `on: workflow_call`.

**Inputs:**
- `integrationRoot` (default: `integration`)
- `platformConfigPath` (default: `integration/platform.json`)
- `e2eDir` (default: `integration/e2e`)
- `mode`, `target` (scheduled/on-demand/pr/local; shell/app)
- Version selectors with per-artifact overrides
- Runtime config (node version, timeouts)

**Outputs:**
- JUnit report artifact
- JSON report (resolved versions, images, provenance)
- Human-readable job summary

## 6) Documentation Guidelines

### Where Documentation Lives

- **Source:** `docs/modules/onecx-integration-tests/` (Antora component)
- **Config:** `docs/antora.yml` (component version: "latest")
- **Navigation:** `docs/modules/onecx-integration-tests/partials/nav.adoc`

### Documentation Skeleton

Pages and their purposes:

| Page | Purpose | Audience |
|------|---------|----------|
| `index.adoc` | Overview, purpose, audience, authoring guidelines | New users |
| `architecture.adoc` | Concept, layers, startup/data-import sequences | Developers |
| `getting-started.adoc` | Hub linking to Contract, E2E, CI, UI Repository | Integrators |
| `contract.adoc` | Platform.json fields, container definitions | Integrators |
| `e2e.adoc` | Running E2E tests, artifacts | Test engineers |
| `ci.adoc` | Reusable workflow, inputs/outputs, GitHub Actions | CI/platform engineers |
| `ui-repository.adoc` | How to use this runner in a UI repo | UI developers |
| `reference.adoc` | CLI options, env vars, run artifacts | Advanced users |

### Writing Style

Follow OneCX Writing Style:
- Imperative voice, present tense, active sentences
- Max 3 heading levels; short, focused labels
- Use bullets, description lists, tables over prose
- Add screenshots for critical steps
- Define acronyms on first use
- Avoid jargon; explain technical terms

## 7) TypeScript & Testcontainers

### Strict Typing

- Use explicit types at all boundaries: CLI input, workflow inputs, config parsing, container definitions
- Implement typed interfaces for PlatformConfig, PlatformRuntime, container definitions
- Fail fast on type mismatch with actionable errors

### Container Lifecycle

Order of operations:
1. **Create network** (testcontainers abstraction)
2. **Start core infrastructure:** PostgreSQL → Keycloak
3. **Start services** (7 microservices, each depends on Postgres + Keycloak)
4. **Start Shell BFF** (depends on Keycloak)
5. **Start Shell UI** (depends on Shell BFF)
6. **Start user-defined containers** (if config.container defined)
7. **Import data** (if importData: true)
8. **Heartbeat/health checks** (if heartbeat.enabled: true)
9. **Run E2E container** (if config.container.e2e defined)
10. **Cleanup:** Stop all containers in reverse order

### Reliability

- Always ensure containers are cleaned up (finally/afterAll)
- Make timeouts and retries configurable
- Prefer structured JSON logs plus human-readable summaries
- Log resolved images and their provenance on every run

## 8) Versioning & "Latest" Tag Semantics

### Non-Negotiable Rules

1. **`latest` = last released product version** (not main, not RC)
2. **Multi-artifact components** (svc/ui/bff) must each have `latest` tag → fail if missing
3. **Tag ambiguity = fail fast** with message: what is missing, where, how to fix
4. **Every run logs resolved images and provenance.** Example: `keycloak: latest (resolved to SHA abc123 from registry.example.com)`
5. **Version resolution is auditable:** CLI output, artifacts, logs must show final choices and reasons
