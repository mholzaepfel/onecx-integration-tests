import { AbstractStartedContainer, GenericContainer, StartedTestContainer, Wait } from 'testcontainers'
import * as fs from 'fs'
import { UiDetails } from '../../models/interfaces/ui.interface'
import { HealthCheckableContainer } from '../../models/interfaces/health-checkable-container.interface'
import { HealthCheckExecutor } from '../../models/interfaces/health-check-executor.interface'
import { SkipHealthCheckExecutor } from '../../utils/health-check-executor'
import {
  CommandHealthCheckConfig,
  HealthCheckConfig,
} from '../../models/interfaces/testcontainers-health-check.adapter'
import { buildWaitStrategies, toTestcontainersHealthCheck } from '../../utils/wait-strategy.utils'
import { issueCertificateFor } from '../../utils/tls-ca'

const DEFAULT_LOG_WAIT_MESSAGE = /start worker process/

// Every UI container gets an 8443 TLS listener (reverse-proxied to its own plain-http port) +
// CORS_ENABLED, so the https shell can load any MFE's manifest/assets cross-origin without
// mixed-content/CORS errors. Certificate is issued per-alias at start() time (see tls-ca.ts);
// consumers can either trust the exported CA or set ignoreHTTPSErrors: true in Playwright.
function buildUiTlsServerConf(upstreamPort: number): string {
  return `server {
  listen 8443 ssl;
  server_name _;
  ssl_certificate     /etc/nginx/certs/tls.crt;
  ssl_certificate_key /etc/nginx/certs/tls.key;
  location / {
    proxy_pass http://127.0.0.1:${upstreamPort};
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $remote_addr;
  }
}
`
}

export class UiContainer extends GenericContainer {
  private details: UiDetails = {
    appBaseHref: '',
    appId: '',
    productName: '',
  }

  private port = 8080

  protected loggingEnabled = false

  protected logFilePath?: string

  private commandHealthCheckConfig?: CommandHealthCheckConfig
  private healthCheckConfigs: HealthCheckConfig[] = []

  constructor(image: string) {
    super(image)
  }

  withAppBaseHref(appBaseHref: string): this {
    this.details.appBaseHref = appBaseHref
    return this
  }

  withAppId(appId: string): this {
    this.details.appId = appId
    return this
  }

  withProductName(productName: string): this {
    this.details.productName = productName
    return this
  }

  withPort(port: number): this {
    this.port = port
    return this
  }

  withCommandHealthCheck(config: CommandHealthCheckConfig): this {
    this.commandHealthCheckConfig = config
    return this
  }

  withHealthChecks(configs: HealthCheckConfig[]): this {
    this.healthCheckConfigs = configs
    return this
  }

  withLoggingEnabled(log: boolean): this {
    this.loggingEnabled = log
    return this
  }

  withLogFilePath(filePath: string): this {
    this.logFilePath = filePath
    return this
  }

  protected getFormattedLogLine(line: string | Buffer): string {
    const timestamp = new Date().toISOString()
    const text = typeof line === 'string' ? line : line.toString()
    return `[${timestamp}] ${text}`
  }

  protected writeLogToFile(line: string | Buffer, logFilePath: string): void {
    const formatted = this.getFormattedLogLine(line)
    fs.appendFileSync(logFilePath, `${formatted}\n`)
  }

  override async start(): Promise<StartedUiContainer> {
    this.withEnvironment({
      ...this.environment,
      APP_BASE_HREF: `${this.details.appBaseHref}`,
      APP_ID: `${this.details.appId}`,
      PRODUCT_NAME: `${this.details.productName}`,
      CORS_ENABLED: 'true',
    })

    if (this.logFilePath) {
      this.withLogConsumer((stream) => {
        stream.on('data', (line) => this.writeLogToFile(line, this.logFilePath!))
        stream.on('err', (line) => this.writeLogToFile(line, this.logFilePath!))
      })
    }

    this.withExposedPorts(this.port, 8443)

    // Cert SAN must match this container's own alias(es), since MFE manifest/asset URLs are
    // rewritten to https://<appid>:8443 and Chromium verifies hostname even with a trusted CA.
    const { cert, key } = await issueCertificateFor([...this.networkAliases, 'localhost'])
    this.withCopyContentToContainer([
      { content: cert, target: '/etc/nginx/certs/tls.crt', mode: 0o644 },
      { content: key, target: '/etc/nginx/certs/tls.key', mode: 0o644 },
      { content: buildUiTlsServerConf(this.port), target: '/etc/nginx/conf.d/tls-ui.conf', mode: 0o644 },
    ])

    const hasCustomConfig = this.commandHealthCheckConfig !== undefined || this.healthCheckConfigs.length > 0

    if (this.commandHealthCheckConfig) {
      this.withHealthCheck(toTestcontainersHealthCheck(this.commandHealthCheckConfig))
    }

    if (hasCustomConfig) {
      const waitStrategies = buildWaitStrategies(this.commandHealthCheckConfig, this.healthCheckConfigs)
      this.withWaitStrategy(Wait.forAll(waitStrategies))
    } else {
      // Default: wait for nginx worker process log message
      this.withWaitStrategy(Wait.forLogMessage(DEFAULT_LOG_WAIT_MESSAGE)).withStartupTimeout(120_000)
    }

    return new StartedUiContainer(
      await super.start(),
      this.details,
      this.networkAliases,
      this.port,
      this.commandHealthCheckConfig,
      this.healthCheckConfigs
    )
  }
}

export class StartedUiContainer extends AbstractStartedContainer implements HealthCheckableContainer {
  constructor(
    startedTestContainer: StartedTestContainer,
    private readonly details: UiDetails,
    private readonly networkAliases: string[],
    private readonly port: number,
    private readonly commandHealthCheck: CommandHealthCheckConfig | undefined,
    private readonly healthCheckConfigs: HealthCheckConfig[]
  ) {
    super(startedTestContainer)
  }

  getHealthCheckExecutor(): HealthCheckExecutor {
    return new SkipHealthCheckExecutor('UI Container')
  }

  getAppBaseHref(): string {
    return this.details.appBaseHref
  }

  getAppId(): string {
    return this.details.appId
  }

  getProductName(): string {
    return this.details.productName
  }

  getNetworkAliases(): string[] {
    return this.networkAliases
  }

  getPort(): number {
    return this.port
  }

  getCommandHealthCheck(): CommandHealthCheckConfig | undefined {
    return this.commandHealthCheck
  }

  getHealthCheckConfigs(): HealthCheckConfig[] {
    return this.healthCheckConfigs
  }

  getStartedTestContainer(): StartedTestContainer {
    return this.startedTestContainer
  }

  getDetails(): UiDetails {
    return this.details
  }
}
