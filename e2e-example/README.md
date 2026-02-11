# E2E Example Container

This is a minimal E2E container that demonstrates how the OneCX integration test platform handles E2E container execution and shutdown.

## Purpose

- Show that the platform starts and waits for E2E container completion
- Demonstrate log output from an E2E container
- Write test results to the `e2e-results` directory
- Exit with code 0 (success) to trigger platform shutdown

## Build

```bash
docker build -t e2e-example:latest ./e2e-example
```

## Environment Variables

| Variable   | Description              | Default                 |
| ---------- | ------------------------ | ----------------------- |
| `BASE_URL` | Target URL for E2E tests | `http://localhost:8080` |

## Output

The container writes the following files to `/reports` inside the container, which is mounted from the host's `e2e-results` directory:

- `e2e-example-results.json` - JSON test results
- `e2e-example.log` - Simple log file

## Usage with integration-tests.json

```json
{
  "platformConfig": {
    "container": {
      "e2e": {
        "image": "e2e-example:latest",
        "networkAlias": "e2e-example",
        "baseUrl": "http://onecx-shell-ui:8080/onecx-shell/"
      }
    }
  }
}
```

## Exit Codes

- `0` - All tests passed, platform should shutdown successfully
- `1` - Tests failed (not implemented in this example)
