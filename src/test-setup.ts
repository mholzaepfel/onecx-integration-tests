// Increase the limit of event listeners to avoid MaxListenersExceededWarning.
// This is caused by testcontainers (or its mocks) registering global cleanup
// listeners for various signals (SIGINT, SIGTERM, etc.) during initialization.
process.setMaxListeners(20)
