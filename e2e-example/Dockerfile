# Minimal E2E Example Container
# This container demonstrates E2E container execution and platform shutdown behavior
FROM alpine:3.19

# Install bash for script execution
RUN apk add --no-cache bash

# Create output directory (will be mounted from host)
# Note: The platform mounts e2e-results to /reports inside the container
RUN mkdir -p /reports

# Copy the test script
COPY run-e2e-example.sh /run-e2e-example.sh
RUN chmod +x /run-e2e-example.sh

# Set working directory
WORKDIR /

# Run the example script
ENTRYPOINT ["/run-e2e-example.sh"]
