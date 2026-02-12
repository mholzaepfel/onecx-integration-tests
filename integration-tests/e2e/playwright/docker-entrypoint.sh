#!/bin/bash
set -e

# ============================================================
# OneCX E2E Test Container Entrypoint
# ============================================================
# Dieses Skript führt die Playwright-Tests aus und stellt sicher,
# dass alle Logs und Ergebnisse in das Output-Verzeichnis geschrieben werden.
# ============================================================

artefacts_ROOT="${artefacts_ROOT:-/e2e-results}"
RUN_ID="${RUN_ID:-local}"
OUTPUT_DIR="${OUTPUT_DIR:-${artefacts_ROOT}}"
LOG_FILE="${OUTPUT_DIR}/test-run.log"

# Logging-Funktion
log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] $1" | tee -a "${LOG_FILE}"
}

# Fehlerbehandlung
cleanup() {
    local exit_code=$?
    log "=========================================="
    log "Test-Ausführung beendet mit Exit-Code: ${exit_code}"
    log "=========================================="
    
    # Zusammenfassung der Ergebnisse
    if [ -f "${OUTPUT_DIR}/test-results.json" ]; then
        log "Test-Ergebnisse verfügbar: ${OUTPUT_DIR}/test-results.json"
    fi
    
    if [ -d "${OUTPUT_DIR}/playwright-report" ]; then
        log "HTML-Report verfügbar: ${OUTPUT_DIR}/playwright-report/index.html"
    fi
    
    if [ -d "${OUTPUT_DIR}/screenshots" ]; then
        log "Screenshots verfügbar: ${OUTPUT_DIR}/screenshots/"
    fi
    
    if [ -d "${OUTPUT_DIR}/test-artefacts" ]; then
        log "Test-artefacts (Videos, Traces): ${OUTPUT_DIR}/test-artefacts/"
    fi
    
    log "Container wird beendet..."
    exit ${exit_code}
}

trap cleanup EXIT

# ============================================================
# Hauptausführung
# ============================================================

log "=========================================="
log "OneCX E2E Test Container gestartet"
log "=========================================="
log "BASE_URL: ${BASE_URL}"
log "KEYCLOAK_USER: ${KEYCLOAK_USER}"
log "OUTPUT_DIR: ${OUTPUT_DIR}"
log "=========================================="

# Verzeichnisse erstellen
mkdir -p "${OUTPUT_DIR}/screenshots"
mkdir -p "${OUTPUT_DIR}/.auth"
mkdir -p "${OUTPUT_DIR}/test-artefacts"
mkdir -p "${OUTPUT_DIR}/playwright-report"

# Warte auf Netzwerk-Verfügbarkeit (optional)
if [ -n "${WAIT_FOR_URL}" ]; then
    log "Warte auf URL: ${WAIT_FOR_URL}"
    timeout=60
    while [ $timeout -gt 0 ]; do
        if curl -s -o /dev/null -w "%{http_code}" "${WAIT_FOR_URL}" | grep -q "200\|302\|301"; then
            log "URL ist erreichbar!"
            break
        fi
        log "Warte... (${timeout}s verbleibend)"
        sleep 5
        timeout=$((timeout - 5))
    done
    
    if [ $timeout -le 0 ]; then
        log "FEHLER: URL nicht erreichbar nach Timeout"
        exit 1
    fi
fi

# Environment-Info loggen
log "Node Version: $(node --version)"
log "NPM Version: $(npm --version)"
log "Playwright Version: $(node_modules/.bin/playwright --version 2>/dev/null || echo 'nicht installiert')"

# Tests ausführen
log "Starte Playwright Tests..."
log "=========================================="

# Führe das übergebene Kommando aus (default: npm test)
exec "$@" 2>&1 | tee -a "${LOG_FILE}"
