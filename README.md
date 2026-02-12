# onecx-integration-tests

OneCX Integration-tests

---

## Development

### Prerequisites

- Node.js (see `package.json` engines field for version requirements)
- npm or yarn

### Building the Project

```sh
npm run build
```

This compiles the TypeScript source code using Nx to JavaScript in the `dist/integration-tests` directory.

### Testing

Run all tests:

```sh
npm test
```

Run tests in CI mode (no watch, with coverage):

```sh
npm run test:ci
```

Run linting:

```sh
npm run lint
```

Format code:

```sh
npm run format
```

## Integration Tests Runner

The Integration Tests Runner is a config-driven orchestrator for platform and E2E tests.

### Quick Start

```sh
# Run with auto-detected config
npm run it:run

# Run with specific config
npm run it:run -- --config=./integration/integration-tests.json

# Dry run (show plan without executing)
npm run it:run:dry

# Verbose output
npm run it:run:verbose
```

### Behavior

- **E2E Mode**: If `platformConfig.container.e2e` is configured → Start platform → Run E2E container → Shutdown
- **Platform-Only Mode**: If no E2E configured → Start platform → Wait for timeout/signal → Shutdown

### CLI Options

| Option                   | Description                    | Default               |
| ------------------------ | ------------------------------ | --------------------- |
| `--config <path>`        | Path to integration-tests.json | Auto-detect           |
| `--timeout-ms <ms>`      | Override suite timeout         | From config or 600000 |
| `--artifacts-dir <path>` | Directory for logs/artifacts   | `./artefacts`         |
| `--verbose`, `-v`        | Enable verbose output          | false                 |
| `--capture-logs`         | Capture all output to log file | false                 |
| `--dry-run`              | Show plan without execution    | false                 |

### Environment Variables

| Variable           | Description                        |
| ------------------ | ---------------------------------- |
| `CONFIG_PATH`      | Alternative to `--config`          |
| `IT_TIMEOUT_MS`    | Alternative to `--timeout-ms`      |
| `IT_ARTIFACTS_DIR` | Alternative to `--artifacts-dir`   |
| `IT_VERBOSE`       | Set to `'true'` for verbose output |
| `IT_CAPTURE_LOGS`  | Set to `'true'` to capture logs    |

### Exit Codes

| Code | Meaning                |
| ---- | ---------------------- |
| 0    | Success                |
| 1    | Config/schema invalid  |
| 2    | Runtime timeout        |
| 3    | Docker/container error |
| 4    | E2E/test failure       |
| 5    | Unexpected error       |

### Artifacts

Each run creates a unique directory in `./artefacts/<run-id>/`:

- `summary.json` - Run summary with status, duration, exit code
- `logs/runner-output.log` - Console output (if `--capture-logs` enabled)
- `e2e-results/` - E2E test results from the container

### Code Quality

This project uses SonarQube for code quality analysis:

```sh
npm run sonar
```

Configuration is in `sonar-project.properties`.

## Publishing

> **Story Created**

**Planned approach:**

- Automated publishing via GitHub Actions on release tags
- Semantic versioning
- NPM registry publication

**Note:** Package is currently marked as `private: true` in `package.json`.

## CI/CD Pipeline

> **Story Created**

**Planned workflows:**

- **On PR**: Lint, test, build validation, Dependency Review, CodeQL and SonarQube analysis
- **On merge to main**: Full test suite, coverage reporting, SonarQube analysis
- **On release tag**: Automated npm publishing

## Dependency Management

> **Stories Created**

- Dependabot
- Renovate bot

---

## License

Apache-2.0

## Contributors

OneCX Development Team <onecx_dev@1000kit.org>
