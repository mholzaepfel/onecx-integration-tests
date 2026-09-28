/**
 * Validates the consumer-facing `workflow_call` interface of `.github/workflows/e2e-tests.yml`.
 *
 * The reusable workflow contract (GitHub issue #73) requires:
 * - a `workflow_call`-only trigger with `verbose` (default `false`) and `captureLogs` (default `true`) boolean inputs
 * - a single `e2e` job that runs on `ubuntu-latest`, uses Node 24 with npm caching, installs locked
 *   dependencies via `npm ci`, and times out after 60 minutes
 * - the caller's `e2e` npm script executed with the `IT_VERBOSE`/`IT_CAPTURE_LOGS` environment defaults
 *   bound to the workflow inputs
 * - an artifact upload and a final "Finalize integration test run" step, both running on every
 *   outcome (`if: always()`), where the finalize step writes the Step Summary and then exits non-zero
 *   on a missing, invalid, or unsuccessful `summary.json` — so a red job only happens after the
 *   diagnostics have been collected
 *
 * Note on validation (issue #73 DoD): a real Shell UI caller run against the published `@v1` tag
 * is the strongest form of validation, but the first caller lives in a separate repository and is
 * out of scope here. This spec provides the equivalent coverage for this repository: it parses the
 * workflow as GitHub would, pins the `workflow_call` interface (triggers, inputs, permissions,
 * environment, step ordering), and executes the embedded `node <<'EOF' ... EOF` block verbatim
 * against fixture artifacts, pinning the Step Summary and the fail/succeed semantics the caller
 * observes. The `v1` tag must be created on the revision this spec has validated.
 *
 * The embedded heredoc is extracted verbatim and executed. The `run: |` block dedents a fixed 10
 * spaces in the YAML source, so the heredoc opener (`node <<'EOF'`), body, and closing `EOF` marker
 * are written at exactly 10 spaces of indentation. The captured group is the raw body (12-space
 * indented) — which is what GitHub Actions actually executes after the YAML block scalar dedents the
 * leading 10 spaces.
 */
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as yaml from 'yaml'

const WORKFLOW_PATH = path.join(__dirname, '..', '..', '.github', 'workflows', 'e2e-tests.yml')

/**
 * Extracts the embedded `node <<'EOF' ... EOF` script body from the workflow YAML. There is
 * exactly one: the "Finalize integration test run" step.
 */
function extractEmbeddedScript(workflowText: string): string {
  const marker = /node <<'EOF'\n([\s\S]*?)\n {10}EOF/g
  const matches: string[] = []
  let match: RegExpExecArray | null
  while ((match = marker.exec(workflowText)) !== null) {
    matches.push(match[1])
  }
  expect(matches).toHaveLength(1)
  return matches[0]
}

interface WorkflowInput {
  type?: string
  required?: boolean
  default?: boolean
  description?: string
}

interface WorkflowJob {
  'runs-on'?: string
  'timeout-minutes'?: number
  env?: Record<string, string>
  steps: WorkflowStep[]
}

interface WorkflowStep {
  name?: string
  uses?: string
  run?: string
  if?: string
  id?: string
  with?: Record<string, string | number>
  env?: Record<string, string>
}

interface WorkflowShape {
  on?: Record<string, unknown> | boolean
  permissions?: Record<string, string>
  jobs?: Record<string, WorkflowJob>
}

function loadWorkflow(): WorkflowShape {
  const raw = fs.readFileSync(WORKFLOW_PATH, 'utf8')
  const doc = yaml.parse(raw) as WorkflowShape
  expect(doc).toBeDefined()
  return doc
}

/**
 * Some YAML parsers normalize the top-level `on` key to `true`; `yaml` (v2) keeps it as the
 * string key `on`. Resolve both so the spec does not depend on the parser's choice.
 */
function onBlock(doc: WorkflowShape): Record<string, unknown> {
  const docRecord = doc as unknown as Record<string, unknown>
  const raw = docRecord['on'] ?? docRecord['true']
  expect(raw).toBeDefined()
  expect(typeof raw).toBe('object')
  return raw as Record<string, unknown>
}

function e2eJob(doc: WorkflowShape): WorkflowJob {
  const jobs = doc.jobs ?? {}
  const job = jobs['e2e']
  expect(job).toBeDefined()
  return job
}

interface RunResult {
  code: number
  stderr: string
  stepSummary: string
}

/**
 * Creates a temp workspace under `os.tmpdir()`. When `summaryContent` is provided the file at
 * `<workspace>/integration-tests/artifacts/run1/summary.json` is written with that content;
 * otherwise only the empty artifacts root layout is created.
 */
function makeWorkspace(summaryContent?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-workflow-spec-'))
  if (summaryContent !== undefined) {
    const summaryPath = path.join(dir, 'integration-tests', 'artifacts', 'run1', 'summary.json')
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true })
    fs.writeFileSync(summaryPath, summaryContent)
  } else {
    fs.mkdirSync(path.join(dir, 'integration-tests', 'artifacts'), { recursive: true })
  }
  return dir
}

function runStep(script: string, cwd: string): RunResult {
  const stepSummary = path.join(cwd, '.github-step-summary')
  const result = spawnSync('node', ['-e', script], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_STEP_SUMMARY: stepSummary, CI: 'true' },
  })
  return {
    code: result.status ?? -1,
    stderr: result.stderr ?? '',
    stepSummary: fs.existsSync(stepSummary) ? fs.readFileSync(stepSummary, 'utf8') : '',
  }
}

const SUMMARY_FIXTURES = {
  success: JSON.stringify({
    runId: 'fixture-success',
    status: 'success',
    exitCode: 0,
    durationMs: 45_000,
    e2eAggregate: { total: 2, succeeded: 2, failed: 0, finalStatus: 'success' },
  }),
  e2eFailure: JSON.stringify({
    runId: 'fixture-failure',
    status: 'failure',
    exitCode: 1,
    e2eAggregate: { total: 2, succeeded: 1, failed: 1, finalStatus: 'failure' },
  }),
  invalid: '{ this is not valid json',
}

describe('.github/workflows/e2e-tests.yml (reusable workflow contract)', () => {
  let script: string
  let doc: WorkflowShape

  beforeAll(() => {
    doc = loadWorkflow()
    script = extractEmbeddedScript(fs.readFileSync(WORKFLOW_PATH, 'utf8'))
  })

  it('is triggered only by workflow_call', () => {
    expect(Object.keys(onBlock(doc))).toEqual(['workflow_call'])
  })

  it('declares boolean verbose/captureLogs inputs with the documented defaults', () => {
    const inputs = (onBlock(doc).workflow_call as { inputs: Record<string, WorkflowInput> }).inputs
    expect(inputs.verbose).toMatchObject({ type: 'boolean', required: false, default: false })
    expect(inputs.captureLogs).toMatchObject({ type: 'boolean', required: false, default: true })
  })

  it('does not require secrets at the interface level', () => {
    expect((onBlock(doc).workflow_call as { secrets?: unknown }).secrets).toBeUndefined()
  })

  it('scopes top-level permissions to `contents: read`', () => {
    expect(doc.permissions).toMatchObject({ contents: 'read' })
  })

  it('configures a single e2e job on ubuntu-latest with a 60 minute timeout', () => {
    const job = e2eJob(doc)
    expect(Object.keys(doc.jobs ?? {})).toEqual(['e2e'])
    expect(job['runs-on']).toBe('ubuntu-latest')
    expect(job['timeout-minutes']).toBe(60)
  })

  it('checks out the caller repository before running any caller scripts', () => {
    const steps = e2eJob(doc).steps
    const checkoutIndex = steps.findIndex((s) => typeof s.uses === 'string' && s.uses.startsWith('actions/checkout@'))
    const runIndex = steps.findIndex((s) => s.name === 'Run integration tests (onecx-it-runner)')
    expect(checkoutIndex).toBeGreaterThanOrEqual(0)
    expect(steps[checkoutIndex]?.with?.['fetch-depth']).toBe(0)
    expect(runIndex).toBeGreaterThan(checkoutIndex)
  })

  it('sets up Node 24 with npm caching and runs `npm ci` before executing the runner', () => {
    const steps = e2eJob(doc).steps
    const setup = steps.find((s) => typeof s.uses === 'string' && s.uses.startsWith('actions/setup-node@'))
    expect(setup?.with?.['node-version']).toBe('24')
    expect(setup?.with?.['cache']).toBe('npm')

    const installIndex = steps.findIndex((s) => typeof s.run === 'string' && s.run.trim() === 'npm ci')
    expect(installIndex).toBeGreaterThanOrEqual(0)

    const setupIndex = steps.findIndex((s) => typeof s.uses === 'string' && s.uses.startsWith('actions/setup-node@'))
    const runIndex = steps.findIndex((s) => s.name === 'Run integration tests (onecx-it-runner)')
    expect(setupIndex).toBeLessThan(installIndex)
    expect(installIndex).toBeLessThan(runIndex)
  })

  it('runs the caller e2e script and binds the workflow inputs to the runner environment defaults', () => {
    const steps = e2eJob(doc).steps
    const run = steps.find((s) => s.name === 'Run integration tests (onecx-it-runner)')
    expect(run?.run).toBe('npm run e2e')
    expect(run?.env).toMatchObject({
      IT_VERBOSE: '${{ inputs.verbose }}',
      IT_CAPTURE_LOGS: '${{ inputs.captureLogs }}',
    })
  })

  it('orders run -> upload artifacts -> finalize, with diagnostics steps on every outcome', () => {
    const steps = e2eJob(doc).steps
    const names = steps.map((s) => s.name)
    const runIndex = names.indexOf('Run integration tests (onecx-it-runner)')
    const uploadIndex = names.indexOf('Upload integration test artifacts')
    const finalizeIndex = names.indexOf('Finalize integration test run')
    expect(runIndex).toBeGreaterThanOrEqual(0)
    expect(uploadIndex).toBeGreaterThanOrEqual(0)
    expect(finalizeIndex).toBeGreaterThanOrEqual(0)
    // The runner step itself must NOT be skipped on failure: a crashed runner must still fail the job.
    expect(steps[runIndex]?.if).toBeUndefined()
    expect(uploadIndex).toBeGreaterThan(runIndex)
    expect(finalizeIndex).toBeGreaterThan(uploadIndex)

    const upload = steps[uploadIndex]
    const finalize = steps[finalizeIndex]
    // Diagnostics (upload) and the fail gate (finalize) run on every outcome, so the job turns
    // red only after the Step Summary and the artifact have been collected.
    expect(upload?.if).toBe('always()')
    expect(finalize?.if).toBe('always()')
    expect(upload?.uses).toMatch(/^actions\/upload-artifact@/)
    expect(upload?.with?.['path']).toBe('integration-tests/artifacts/')
    expect(upload?.with?.['if-no-files-found']).toBe('warn')
    expect(String(upload?.with?.['name'])).toMatch(/^e2e-artifacts-\$\{\{ github\.run_id \}\}/)
    // No consumer of workflow outputs exists (single job), so the finalize step must not
    // declare an `id` that implies step outputs.
    expect(finalize?.id).toBeUndefined()
  })

  describe('embedded "Finalize integration test run" script', () => {
    it('exits 0 on a successful summary.json and renders a multi-line Step Summary', () => {
      const cwd = makeWorkspace(SUMMARY_FIXTURES.success)
      const result = runStep(script, cwd)
      expect(result.code).toBe(0)
      expect(result.stderr).not.toContain('ERROR:')
      expect(result.stepSummary).toContain('## Integration Test Run Summary')
      expect(result.stepSummary).toContain('| Status | **SUCCESS** |')
      expect(result.stepSummary).toContain('fixture-success')
      expect(result.stepSummary).toContain('| E2E | 2/2 succeeded, 0 failed (success) |')
      expect(result.stepSummary.split('\n').length).toBeGreaterThan(5)
    })

    it('exits 1 on an unsuccessful summary.json (status=failure) and renders the failure status', () => {
      const cwd = makeWorkspace(SUMMARY_FIXTURES.e2eFailure)
      const result = runStep(script, cwd)
      expect(result.code).toBe(1)
      expect(result.stderr).toContain('unsuccessful')
      expect(result.stderr).toContain('status=failure')
      expect(result.stderr).toContain('E2E aggregate: 1/2 succeeded, 1 failed')
      expect(result.stepSummary).toContain('| Status | **FAILURE** |')
      expect(result.stepSummary).toContain('| E2E | 1/2 succeeded, 1 failed (failure) |')
    })

    it('exits 1 when no summary.json exists and still writes the Step Summary', () => {
      const cwd = makeWorkspace(undefined)
      const result = runStep(script, cwd)
      expect(result.code).toBe(1)
      expect(result.stderr).toContain('missing summary.json')
      expect(result.stepSummary).toContain('No valid `summary.json` was found')
    })

    it('exits 1 when the summary.json is not valid JSON and still writes the Step Summary', () => {
      const cwd = makeWorkspace(SUMMARY_FIXTURES.invalid)
      const result = runStep(script, cwd)
      expect(result.code).toBe(1)
      expect(result.stderr).toContain('Invalid summary.json')
      expect(result.stepSummary).toContain('| Status | **MISSING** |')
    })

    it('prefers the most recent run directory over older ones', () => {
      const cwd = makeWorkspace(undefined)
      const older = path.join(cwd, 'integration-tests', 'artifacts', 'run-old')
      const newer = path.join(cwd, 'integration-tests', 'artifacts', 'run-new')
      fs.mkdirSync(older, { recursive: true })
      fs.mkdirSync(newer, { recursive: true })
      fs.writeFileSync(path.join(older, 'summary.json'), SUMMARY_FIXTURES.e2eFailure)
      fs.writeFileSync(path.join(newer, 'summary.json'), SUMMARY_FIXTURES.success)
      // Force distinct mtimes: `run-old` is the older run.
      const olderTime = new Date('2020-01-01T00:00:00Z').getTime()
      fs.utimesSync(older, olderTime / 1000, olderTime / 1000)
      fs.utimesSync(path.join(older, 'summary.json'), olderTime / 1000, olderTime / 1000)
      const newerTime = Date.now()
      fs.utimesSync(newer, newerTime / 1000, newerTime / 1000)
      fs.utimesSync(path.join(newer, 'summary.json'), newerTime / 1000, newerTime / 1000)

      const result = runStep(script, cwd)
      expect(result.code).toBe(0)
      expect(result.stepSummary).toContain('fixture-success')
    })
  })
})
