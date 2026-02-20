# onecx-integration-tests

OneCX integration test toolkit for starting a local platform stack (via Testcontainers), validating health, and optionally executing E2E tests.

## What this project provides

- A programmatic API (`PlatformManager`) to orchestrate platform containers.
- A CLI runner (`it-runner`) for end-to-end integration test execution.
- Config-driven startup from `integration-tests/platform/platform.json`.
- Run artefacts with summaries, logs, reports, and E2E outputs.

## Public API

The package exports the following symbols from `src/index.ts`:

- `PlatformManager`
- `PlatformConfig`
- `CONTAINER`
- `AllowedContainerTypes` (type)

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

Run a dry run (validation + execution plan only):

```sh
npm run it:run -- --dry-run
```

Run with verbose output and log capture:

```sh
npm run it:run -- --verbose --capture-logs
```

## Runner behavior

- **E2E mode**: If `platformConfig.container.e2e` exists, the runner starts the platform, waits for health checks, runs E2E, then shuts down.
- **Platform-only mode**: If no E2E container is configured, the runner starts and validates the platform, collects artefacts, then shuts down.

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
- The config is validated against the project schema before execution.
- If no valid config is found, the runner exits with config error.

## Artefacts

Each run creates a directory under:

`integration-tests/artefacts/<run-id>/`

Typical output:

- `summary.json` – run metadata (status, duration, mode, exit code)
- `logs/runner-output.log` – runner logs (with `--capture-logs`)
- `logs/containers.log` – captured container/terminal streams (written when `--capture-logs` is enabled)
- `reports/` – generated reports
- `results-e2e/` – E2E result files
- `e2e-results/` – copied E2E output (if source path differs)

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

## License

Apache-2.0

## Contributors

OneCX Development Team <onecx_dev@1000kit.org>
