# onecx-integration-tests

OneCX integration test toolkit for starting a local platform stack (via Testcontainers), validating health, and optionally executing E2E tests.

## What this project provides

- A programmatic API (`PlatformManager`) to orchestrate platform containers.
- A CLI runner (`it-runner`) for end-to-end integration test execution.
- Config-driven startup with default lookup at `integration-tests/platform/platform.json`.
- Run artifacts with summaries, logs, reports, and E2E outputs.

## Public API

The package currently exports the following symbol from `src/index.ts`:

- `PlatformManager`

## Prerequisites

- Node.js and npm
- Docker (required for Testcontainers-based execution)

## Quick Start

Install dependencies:

```sh
npm install
```

Run the integration test runner:

```sh
npm run it:run
```

Run a dry run (validation + mode detection only):

```sh
npm run it:run -- --dry-run
```

Run with verbose output and log capture:

```sh
npm run it:run -- --verbose --capture-logs
```

Show CLI help:

```sh
npm run it:run -- --help
```

## Runner behavior

- **E2E mode**: If `platformConfig.container.e2e` exists, the runner starts the platform, waits for health checks, runs E2E, then shuts down.
- **Platform-only mode**: If no E2E container is configured, the runner starts and validates the platform, collects artifacts, then shuts down.
- **Dry-run mode** (`--dry-run`): Validates and resolves configuration, determines run mode, creates run artifact directories, and exits without starting containers.

## CLI options (`it-runner`)

| Option           | Description                           | Default |
| ---------------- | ------------------------------------- | ------- |
| `-v, --verbose`  | Enable verbose output                 | `false` |
| `--capture-logs` | Capture runner console output to file | `false` |
| `--dry-run`      | Print execution plan without running  | `false` |
| `-h, --help`     | Show help                             | `false` |

## Supported environment variables

| Variable          | Description                                     |
| ----------------- | ----------------------------------------------- |
| `IT_VERBOSE`      | Default for `--verbose` (`true` / `false`)      |
| `IT_CAPTURE_LOGS` | Default for `--capture-logs` (`true` / `false`) |

## Configuration

- Default config path: `integration-tests/platform/platform.json`
- If no explicit config path is provided, the validator first checks the default path and then searches recursively from the current working directory for files matching `*platform.json`.
- The config is validated against the project schema before execution.
- If no valid config is found, the runner exits with status `failure`.

## Artifacts

Each run creates a directory under:

`integration-tests/artifacts/<run-id>/`

Typical output:

- `summary.json` – run metadata (status, duration, mode, exit code)
- `logs/runner-output.log` – runner logs (with `--capture-logs`)
- `logs/containers.log` – captured stdout/stderr and container streams (written when `--capture-logs` is enabled)
- `reports/` – generated reports
- `e2e/` – runtime metadata (for example `platform-info.json`)
- `e2e-results/` – E2E result files

Additional generated runtime metadata may be exported by the platform runtime to the same run artifacts directory.

## Development

Build:

```sh
npm run build
```

Test:

```sh
npm test
```

CI test command:

```sh
npm run test:ci
```

Lint:

```sh
npm run lint
```

Format:

```sh
npm run format
```

Sonar analysis:

```sh
npm run sonar
```

## E2E Playwright project

Playwright tests are located in:

`integration-tests/e2e/playwright`

See its local README for container execution and local debug commands.

## Import Data Assets

Import payloads and import logic used by the platform data importer are located under:

`src/imports`

Assumptions about container network aliases used by import payloads are documented in:

`docs/import-assumptions.adoc`

## License

Apache-2.0

## Contributors

OneCX Development Team <onecx_dev@1000kit.org>
