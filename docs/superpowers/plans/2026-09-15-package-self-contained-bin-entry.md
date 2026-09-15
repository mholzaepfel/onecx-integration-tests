# Make the package consumer self-contained and fix the bin entry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single install of `@onecx/integration-tests` (registry, packed tarball, or local build) runs the integration-test runner with no consumer-side install of `testcontainers`, `dockerode`, or `axios`, and the published `onecx-it-runner` binary resolves inside the installed layout.

**Architecture:** Move the three test-infrastructure packages from `peerDependencies` to `dependencies` (and drop the duplicate `testcontainers` `devDependency`) so the package owns its runtime closure; make the build step that emits the publish-level manifest (`scripts/copy-dist-assets.js`) copy `dependencies` instead of `peerDependencies`; and correct the `bin` target to `it-runner/index.js` so it resolves inside the published layout (the build output `dist/` is the package root, mirroring the `exports["./it-runner"]` entry). Re-sync `package-lock.json` so `npm ci` stays green.

**Tech Stack:** TypeScript (strict), Node.js, `npm`, `tsc` build (`tsconfig.build.json` → `dist/`), a plain-Node `fs` post-build script (`scripts/copy-dist-assets.js`), Jest + ts-jest (unit gates), `npm pack` for tarball verification.

**Spec:** GitHub issue #762 (https://github.com/onecx/internal-tasks/issues/762) — "Make the package consumer self-contained and fix the bin entry", affected repository https://github.com/onecx/onecx-integration-tests.

## Global Constraints

- **Version ranges are preserved verbatim.** `axios: ^1.18.0`, `dockerode: ^5.0.0`, `testcontainers: ^10.28.0`. Do not bump, pin, or relax any of these ranges.
- **No `peerDependencies` remain** anywhere in the package manifest (`package.json`) or in the generated publish manifest (`dist/package.json`).
- **`testcontainers` appears exactly once** in `package.json` (in `dependencies`); the duplicate `devDependencies.testcontainers` is removed.
- **The `bin` target becomes `it-runner/index.js`** (drop the `dist/` prefix), matching `exports["./it-runner"]` (`./it-runner/index.js`). Do not rename the physical source file.
- **Existing Jest suite passes unchanged.** Do not add, remove, or modify any `*.spec.ts` test.
- **`package-lock.json` must be in sync with `package.json`** so `npm ci` succeeds.
- **Do not touch** `files: ["dist"]`, `publishConfig`, `main`, `types`, `exports`, or the `overrides` block.
- **Non-negotiable (CLAUDE.md §8):** version-resolution semantics and run-matrix rules are unrelated to this change and must not be affected.
- **Documentation is out of scope for this ticket.** Consumer-contract doc pages are updated by the dedicated documentation ticket; this ticket only records that fact (see Notes).

---

## Background (read first — the implementer has no other context)

- The runner's CLI entry source is `src/it-runner/index.ts` (has a `#!/usr/bin/env node` shebang). `tsconfig.build.json` compiles `src/**` (rootDir `src`, outDir `dist`), so the compiled entry lands at **`dist/it-runner/index.js`**.
- `scripts/release.js` runs `npm publish ./dist` — i.e. the **`dist/` directory is the package root** of the published artifact. Therefore inside the installed package the runner lives at `it-runner/index.js` (no `dist/` prefix), and the publish-level manifest is the generated **`dist/package.json`**.
- `dist/package.json` is NOT checked in; it is produced at build time by `scripts/copy-dist-assets.js` (`build:package` = `tsc -p tsconfig.build.json && node ./scripts/copy-dist-assets.js`).
- The three packages are direct runtime imports (e.g. `import { ... } from 'testcontainers'`, `import Dockerode from 'dockerode'`, `import axios from 'axios'`) throughout `src/lib/**`, so they must be `dependencies`, not peers.
- Verification packs the **built** package (`npm pack ./dist`) because that is exactly what the release step publishes.

### Task order and dependencies

1. **Task 1** — edit `package.json` (the source of truth). *(no deps)*
2. **Task 2** — edit `scripts/copy-dist-assets.js` so the generated manifest copies `dependencies`. *(logically after Task 1; reads `package.json` at build time)*
3. **Task 3** — re-sync `package-lock.json` to the new `package.json`. *(depends on Task 1)*
4. **Task 4** — run the quality gates + `npm pack ./dist` inspection. *(depends on Tasks 1–3)*

---

### Task 1: Repackage `package.json` — dependencies, no peers, fixed `bin`

**Files:**
- Modify: `package.json` (root manifest)

**Interfaces:**
- Consumes: nothing.
- Produces: a `package.json` whose `dependencies` contain `axios`, `dockerode`, `testcontainers`; no `peerDependencies`; no `devDependencies.testcontainers`; `bin["onecx-it-runner"] === "it-runner/index.js"`. Task 3 regenerates the lockfile from this; Task 4 verifies it.

- [ ] **Step 1: Move the three packages into `dependencies` and keep the ranges**

Replace the current `dependencies` block:

```json
  "dependencies": {
    "ajv": "^8.17.1",
    "commander": "^13.1.0"
  },
```

with:

```json
  "dependencies": {
    "ajv": "^8.17.1",
    "axios": "^1.18.0",
    "commander": "^13.1.0",
    "dockerode": "^5.0.0",
    "testcontainers": "^10.28.0"
  },
```

- [ ] **Step 2: Delete the entire `peerDependencies` block**

Remove these lines in full (including the surrounding braces), so that no `peerDependencies` key exists:

```json
  "peerDependencies": {
    "axios": "^1.18.0",
    "dockerode": "^5.0.0",
    "testcontainers": "^10.28.0"
  },
```

After removal, `"devDependencies": {` should directly follow the `"dependencies"` block (with its closing `},` preserved).

- [ ] **Step 3: Remove the duplicate `testcontainers` from `devDependencies`**

Delete this single line from the `devDependencies` object:

```json
    "testcontainers": "^10.28.0",
```

(Leave `"sonarqube-scanner": "^4.3.2",` and `"ts-jest": "^29.1.0",` intact.)

- [ ] **Step 4: Fix the `bin` entry to resolve inside the published layout**

Replace:

```json
  "bin": {
    "onecx-it-runner": "dist/it-runner/index.js"
  },
```

with:

```json
  "bin": {
    "onecx-it-runner": "it-runner/index.js"
  },
```

- [ ] **Step 5: Validate the manifest is well-formed JSON and matches the constraints**

Run:

```bash
node -e "const p=require('./package.json');
if(!p.dependencies.axios||!p.dependencies.dockerode||!p.dependencies.testcontainers) throw new Error('deps missing');
if('peerDependencies' in p) throw new Error('peerDependencies still present');
if(p.devDependencies.testcontainers) throw new Error('testcontainers still in devDependencies');
if(p.bin['onecx-it-runner']!=='it-runner/index.js') throw new Error('bin not fixed');
console.log('package.json OK:', JSON.stringify(p.dependencies), p.bin['onecx-it-runner']);"
```

Expected: prints `package.json OK: {"ajv":"^8.17.1","axios":"^1.18.0","commander":"^13.1.0","dockerode":"^5.0.0","testcontainers":"^10.28.0"} it-runner/index.js`. Any `throw` means an edit above is wrong — fix and re-run.

---

### Task 2: Make the publish manifest copy `dependencies` (drop `peerDependencies`)

**Files:**
- Modify: `scripts/copy-dist-assets.js:63-76`

**Interfaces:**
- Consumes: the root `package.json` (reads `rootPackageJson.*` at build time).
- Produces: `dist/package.json` (the publish manifest) that contains a `dependencies` field equal to the root `dependencies` and **no** `peerDependencies` field.

- [ ] **Step 1: Change the `distPackageJson` object to copy `dependencies` and stop copying `peerDependencies`**

Replace this block:

```js
const distPackageJson = {
  name: rootPackageJson.name,
  version: rootPackageJson.version,
  license: rootPackageJson.license,
  repository: rootPackageJson.repository,
  main: rootPackageJson.main,
  types: rootPackageJson.types,
  exports: rootPackageJson.exports,
  bin: rootPackageJson.bin,
  peerDependencies: rootPackageJson.peerDependencies || {},
  publishConfig: rootPackageJson.publishConfig,
}
```

with this block (adds the `dependencies` line, removes the `peerDependencies` line — order kept so the manifest reads cleanly and the trailing-comma style is unchanged):

```js
const distPackageJson = {
  name: rootPackageJson.name,
  version: rootPackageJson.version,
  license: rootPackageJson.license,
  repository: rootPackageJson.repository,
  main: rootPackageJson.main,
  types: rootPackageJson.types,
  exports: rootPackageJson.exports,
  bin: rootPackageJson.bin,
  dependencies: rootPackageJson.dependencies || {},
  publishConfig: rootPackageJson.publishConfig,
}
```

- [ ] **Step 2: Rebuild and confirm the generated publish manifest is correct**

Run:

```bash
npm run build
node -e "const m=require('./dist/package.json');
if(!m.dependencies||!m.dependencies.axios||!m.dependencies.dockerode||!m.dependencies.testcontainers) throw new Error('dist manifest missing dependencies');
if('peerDependencies' in m) throw new Error('dist manifest still has peerDependencies');
if(m.bin['onecx-it-runner']!=='it-runner/index.js') throw new Error('dist manifest bin not fixed');
console.log('dist/package.json OK:', JSON.stringify(m.dependencies), m.bin['onecx-it-runner']);"
```

Expected: prints `dist/package.json OK: {"axios":"^1.18.0","commander":"^13.1.0","ajv":"^8.17.1","dockerode":"^5.0.0","testcontainers":"^10.28.0"} it-runner/index.js` (key order may vary). Any `throw` means the edit is wrong — fix and re-run.

---

### Task 3: Re-sync `package-lock.json` with the new `package.json`

**Files:**
- Regenerate: `package-lock.json` (tool-managed; do not hand-edit)

**Interfaces:**
- Consumes: the updated `package.json` from Task 1.
- Produces: a `package-lock.json` consistent with `package.json`, so `npm ci` succeeds.

- [ ] **Step 1: Regenerate the lockfile from `package.json`**

The checked-in `package-lock.json` root block is out of sync with `package.json` (it still lists unreferenced `@nx/*` entries under `dependencies`/`devDependencies`/`peerDependencies`). Regenerate it so it reflects the new manifest:

```bash
npm install --package-lock-only
```

This rebuilds the lockfile from `package.json` without touching `node_modules` or `package.json`, moves `axios`/`dockerode`/`testcontainers` into the root `dependencies`, and prunes the stale `@nx/*` entries.

- [ ] **Step 2: Confirm the lockfile root block now matches the manifest**

Run:

```bash
node -e "const l=require('./package-lock.json').packages[''];
if(!l.dependencies.axios||!l.dependencies.dockerode||!l.dependencies.testcontainers) throw new Error('lockfile deps missing');
if('peerDependencies' in l) throw new Error('lockfile still has peerDependencies');
if(l.devDependencies.testcontainers) throw new Error('lockfile testcontainers still in devDependencies');
console.log('lockfile root OK:', JSON.stringify(l.dependencies));"
```

Expected: prints `lockfile root OK: {"ajv":"^8.17.1","axios":"^1.18.0","commander":"^13.1.0","dockerode":"^5.0.0","testcontainers":"^10.28.0"}`.

- [ ] **Step 3: Prove the install gate is green**

Run:

```bash
npm ci
```

Expected: succeeds with no `ERESOLVE`/EUSAGE/"package.json and package-lock.json are not in sync" error, and installs the three packages into `node_modules`.

---

### Task 4: Verify quality gates and the packed tarball

**Files:**
- None (verification only).

**Interfaces:**
- Consumes: the finished `package.json` (Task 1), `scripts/copy-dist-assets.js` (Task 2), and `package-lock.json` (Task 3).
- Produces: evidence (printed output / a packed tarball) that all acceptance criteria are met.

- [ ] **Step 1: Run the repository quality gates in order**

Run (each must exit 0):

```bash
npm ci
npm run lint
npm run build
npm run test:ci
```

Expected: `lint` clean, `build` produces `dist/` (including `dist/it-runner/index.js` and the generated `dist/package.json`), and `test:ci` reports the existing Jest suite passing with no changes.

- [ ] **Step 2: Confirm the compiled runner entry exists in the build output**

Run:

```bash
test -f dist/it-runner/index.js && echo "runner entry present" || (echo "MISSING dist/it-runner/index.js" && exit 1)
```

Expected: prints `runner entry present`.

- [ ] **Step 3: Pack the built package exactly as the release publishes it**

Run:

```bash
rm -f onecx-integration-tests-*.tgz
npm pack ./dist
```

Expected: produces `onecx-integration-tests-0.7.0.tgz` (filename version follows `dist/package.json`).

- [ ] **Step 4: Verify the tarball's bin target resolves to a real file and the manifest is correct**

Run:

```bash
TARBALL=$(ls -1 onecx-integration-tests-*.tgz | head -1)
tar -tzf "$TARBALL" | grep -E '^\./it-runner/index\.js$' || { echo "bin target ./it-runner/index.js NOT in tarball"; exit 1; }
tar -xzOf "$TARBALL" package/package.json | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  const m=JSON.parse(s);
  if(!m.dependencies||!m.dependencies.axios||!m.dependencies.dockerode||!m.dependencies.testcontainers) throw new Error('packed manifest missing dependencies');
  if('peerDependencies' in m) throw new Error('packed manifest still has peerDependencies');
  if(m.bin['onecx-it-runner']!=='it-runner/index.js') throw new Error('packed manifest bin not fixed');
  console.log('packed manifest OK:', JSON.stringify(m.dependencies), m.bin['onecx-it-runner']);
});"
```

Expected: `./it-runner/index.js` appears in the tarball listing and `packed manifest OK: ...` is printed with `axios`/`dockerode`/`testcontainers` in `dependencies`, no `peerDependencies`, and `bin` = `it-runner/index.js`.

- [ ] **Step 5: Prove the consumer story end-to-end (self-contained install + runnable bin)**

Install the packed tarball into a scratch consumer project and confirm the runner's own `dependencies` install it with no consumer-side declaration. Resolve the tarball to an absolute path from the repo root, then run the whole check as a single command:

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
TARBALL="$(cd "$REPO_ROOT" && ls -1 onecx-integration-tests-*.tgz | head -1)"
rm -rf /tmp/it-consumer-check && mkdir -p /tmp/it-consumer-check
cd /tmp/it-consumer-check
npm init -y >/dev/null
npm install --no-audit --no-fund "$REPO_ROOT/$TARBALL"
test -d node_modules/axios && test -d node_modules/dockerode && test -d node_modules/testcontainers && echo "runtime deps auto-installed"
node_modules/.bin/onecx-it-runner --help
```

Expected: `axios`, `dockerode`, and `testcontainers` are installed into `node_modules` purely from the package's `dependencies` (the consumer declared none of them) → prints `runtime deps auto-installed`; and `onecx-it-runner --help` prints the CLI help and exits 0 (no "cannot find module" / missing-bin error).

- [ ] **Step 6: Clean up the verification artifacts so they are not committed**

Run (from the repo root):

```bash
rm -f onecx-integration-tests-*.tgz
rm -rf /tmp/it-consumer-check
```

Expected: repo working tree contains only the intended source changes (`package.json`, `scripts/copy-dist-assets.js`, `package-lock.json`); the `dist/` build output and any tarball are not staged/committed.

- [ ] **Step 7: Record the inspection evidence in the ticket/PR**

Capture, in the PR description or a ticket comment, the exact `npm pack ./dist` tarball name, the `bin` target path present in the tarball, and the packed `dependencies` (this satisfies the Definition of Done's "verified via the local npm pack inspection recorded in the ticket or PR").

---

## Verification Steps

Full acceptance gate (run from the repo root, in order):

```bash
npm ci
npm run lint
npm run build
npm run test:ci
test -f dist/it-runner/index.js && echo "runner entry present"
npm pack ./dist
```

Then inspect the packed artifact:

```bash
TARBALL=$(ls -1 onecx-integration-tests-*.tgz | head -1)
tar -tzf "$TARBALL" | grep -E '^\./it-runner/index\.js$'          # bin target exists in tarball
tar -xzOf "$TARBALL" package/package.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const m=JSON.parse(s);console.log('deps:',JSON.stringify(m.dependencies),'peers:','peerDependencies' in m,'bin:',m.bin['onecx-it-runner'])})"
```

**Acceptance criteria (all must hold):**

- [ ] `package.json` declares `axios`, `dockerode`, `testcontainers` under `dependencies` with the existing ranges (`^1.18.0`, `^5.0.0`, `^10.28.0`) and has **no** `peerDependencies`.
- [ ] `dist/package.json` (the generated publish manifest) contains `dependencies` (with the three packages) and **no** `peerDependencies`.
- [ ] The packed tarball (`npm pack ./dist`) contains `./it-runner/index.js` and its `bin` target is `it-runner/index.js`.
- [ ] `package-lock.json` is in sync (npm ci is green) and the existing Jest suite (`test:ci`) passes unchanged.
- [ ] A consumer `npm install` of the packed tarball auto-installs `axios`/`dockerode`/`testcontainers` and `onecx-it-runner --help` runs.

## Notes

- **Documentation (out of scope):** consumer-contract documentation pages (`docs/modules/onecx-integration-tests/pages/*.adoc`, e.g. `contract.adoc`, `ui-repository.adoc`) are updated by the dedicated documentation ticket. This ticket deliberately makes **no** doc edits; record in the PR that documentation changes are handled by that ticket (per the Definition of Done).
- **`package-lock.json` staleness (pre-existing):** the checked-in lockfile's root block still listed unreferenced `@nx/*` entries that are absent from `package.json`. `npm install --package-lock-only` (Task 3) both applies this change and re-syncs the lockfile; after it, `npm ci` is green. This regeneration is required for the "npm ci remains green" gate and is not a scope expansion — it is a direct consequence of editing the dependency sections.
- **Do not add a top-level `files`/manifest change to make plain `npm pack` (root) pass.** The release publishes `./dist` (`scripts/release.js`), so the correct pack/verify target is `npm pack ./dist`. Plain `npm pack` from the repo root honors `files: ["dist"]` and would not reflect the published layout.
- **`.spec.ts` / source-map exclusion:** `tsconfig.build.json` excludes `**/*.spec.ts`/`**/*.test.ts` from the compile, so the runner build does not depend on spec files. The Jest suite runs against source (not `dist`) and is unaffected by these manifest changes.
- **Version bumps are out of scope.** Do not run `npm version` / `npm run release`; the release workflow owns versioning.
- **If `npm ci` reports a sync error after Task 3**, re-run `npm install --package-lock-only` and confirm the `packages[""]` block of `package-lock.json` matches `package.json` before proceeding to Task 4.
