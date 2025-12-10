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
