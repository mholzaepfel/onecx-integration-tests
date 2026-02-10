#!/bin/bash
# Minimal E2E Example Script
# This script demonstrates a simple E2E container that logs output and writes results

set -e

# Configuration from environment variables
BASE_URL="${BASE_URL:-http://localhost:8080}"
KEYCLOAK_USER="${KEYCLOAK_USER:-onecx}"
# Note: The platform mounts the host's e2e-results directory to /reports inside the container
RESULTS_DIR="/reports"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

echo "=========================================="
echo "  OneCX E2E Example Container Started"
echo "=========================================="
echo ""
echo "Environment:"
echo "  BASE_URL: ${BASE_URL}"
echo "  KEYCLOAK_USER: ${KEYCLOAK_USER}"
echo "  TIMESTAMP: ${TIMESTAMP}"
echo ""

# Simulate E2E test execution
echo "[INFO] Starting E2E example tests..."
sleep 2

echo "[INFO] Test 1: Checking platform availability..."
sleep 1
echo "[PASS] Platform is configured"

echo "[INFO] Test 2: Verifying environment variables..."
sleep 1
echo "[PASS] Environment variables are set"

echo "[INFO] Test 3: Writing test results..."
sleep 1

# Write results to the mounted e2e-results directory
RESULT_FILE="${RESULTS_DIR}/e2e-example-results.json"
cat > "${RESULT_FILE}" << EOF
{
  "testRun": {
    "timestamp": "${TIMESTAMP}",
    "container": "e2e-example",
    "baseUrl": "${BASE_URL}",
    "keycloakUser": "${KEYCLOAK_USER}"
  },
  "results": {
    "total": 3,
    "passed": 3,
    "failed": 0,
    "skipped": 0
  },
  "tests": [
    {
      "name": "Platform availability check",
      "status": "passed",
      "duration": "1s"
    },
    {
      "name": "Environment variables verification",
      "status": "passed", 
      "duration": "1s"
    },
    {
      "name": "Result file creation",
      "status": "passed",
      "duration": "1s"
    }
  ],
  "summary": "All example tests passed successfully"
}
EOF

echo "[PASS] Results written to ${RESULT_FILE}"

# Write a simple log file
LOG_FILE="${RESULTS_DIR}/e2e-example.log"
cat > "${LOG_FILE}" << EOF
E2E Example Container Log
==========================
Timestamp: ${TIMESTAMP}
Base URL: ${BASE_URL}
User: ${KEYCLOAK_USER}

Test Execution:
- Test 1: PASSED
- Test 2: PASSED  
- Test 3: PASSED

All tests completed successfully.
Container will exit with code 0.
EOF

echo "[PASS] Log written to ${LOG_FILE}"

echo ""
echo "=========================================="
echo "  E2E Example Tests Completed"
echo "  Status: SUCCESS (exit code 0)"
echo "=========================================="
echo ""
echo "This container will now exit."
echo "The platform should detect the exit and begin shutdown."
echo ""

# Exit with success code
exit 0
