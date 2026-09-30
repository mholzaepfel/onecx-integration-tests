import * as fsPromises from 'fs/promises'
import axios from 'axios'
import { importMicrofrontends, UiEntryMap } from './import-product-store'

jest.mock('fs/promises')
jest.mock('axios')

/**
 * Tests for the relative -> absolute Docker-network URL transform performed by `importMicrofrontends`.
 *
 * `resolveRemoteUrls` is module-private, so it is exercised through the public `importMicrofrontends`,
 * which reads an MFE data file and PUTs the transformed payload to the product store. `fs/promises` and
 * `axios` are mocked so no real I/O or network is touched, and the transformed payload is asserted on
 * the `axios.put` call.
 *
 * The scenarios guard the contracts that matter for the mf-manifest work: stable root defaults,
 * independent entry/base path overrides, and absolute URLs that remain untouched.
 */

const readdirMock = fsPromises.readdir as unknown as jest.Mock
const readFileMock = fsPromises.readFile as unknown as jest.Mock
const putMock = axios.put as unknown as jest.Mock

const appid = 'onecx-workspace-ui'
const file = `onecx-product_${appid}_user-menu.json`
// The product-store internal port that the legacy path resolves against.
const productStorePort = 8080

/** Read back the MFE payload (the transformed data) that was PUT to the product store. */
function putPayload(): { remoteEntry?: string; remoteBaseUrl?: string } {
  return putMock.mock.calls[0][1] as { remoteEntry?: string; remoteBaseUrl?: string }
}

describe('importMicrofrontends URL transform', () => {
  // The MFE file present in the (mocked) microfrontends directory.
  beforeEach(() => {
    jest.clearAllMocks()
    readdirMock.mockResolvedValue([file])
    putMock.mockResolvedValue({ status: 200 })
  })

  it('uses import paths when no UI paths are configured', async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({ remoteEntry: '/mfe/workspace/remoteEntry.js', remoteBaseUrl: '/mfe/workspace/' })
    )

    await importMicrofrontends('/data', 'http://ps:8080', productStorePort, undefined)

    expect(putPayload().remoteEntry).toBe('http://onecx-workspace-ui:8080/mfe/workspace/remoteEntry.js')
    expect(putPayload().remoteBaseUrl).toBe('http://onecx-workspace-ui:8080/mfe/workspace/')
  })

  it('falls back to legacy behaviour when the uiEntries map has no entry for this appid', async () => {
    // "Not all MFEs use mf-manifest": another app is configured, this one is not.
    const uiEntries: UiEntryMap = {
      'onecx-other-ui': { alias: 'other-ui', port: 4300, entry: '/mfe/other/mf-manifest.json' },
    }
    readFileMock.mockResolvedValue(
      JSON.stringify({ remoteEntry: '/mfe/workspace/remoteEntry.js', remoteBaseUrl: '/mfe/workspace/' })
    )

    await importMicrofrontends('/data', 'http://ps:8080', productStorePort, uiEntries)

    expect(putPayload().remoteEntry).toBe('http://onecx-workspace-ui:8080/mfe/workspace/remoteEntry.js')
    expect(putPayload().remoteBaseUrl).toBe('http://onecx-workspace-ui:8080/mfe/workspace/')
  })

  it('uses relative paths from import data when no UI paths are configured', async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({ remoteEntry: '/proxy/mf-manifest.json', remoteBaseUrl: '/proxy/app/' })
    )

    await importMicrofrontends('/data', 'http://ps:8080', productStorePort, undefined)

    expect(putPayload().remoteEntry).toBe('http://onecx-workspace-ui:8080/proxy/mf-manifest.json')
    expect(putPayload().remoteBaseUrl).toBe('http://onecx-workspace-ui:8080/proxy/app/')
  })

  it('uses the recorded UI container host for a legacy entry without an explicit path', async () => {
    const uiEntries: UiEntryMap = {
      [appid]: { alias: 'workspace-ui', port: 4200 },
    }
    readFileMock.mockResolvedValue(
      JSON.stringify({ remoteEntry: '/mfe/workspace/remoteEntry.js', remoteBaseUrl: '/mfe/workspace/' })
    )

    await importMicrofrontends('/data', 'http://ps:8080', productStorePort, uiEntries)

    expect(putPayload().remoteEntry).toBe('http://workspace-ui:4200/mfe/workspace/remoteEntry.js')
    expect(putPayload().remoteBaseUrl).toBe('http://workspace-ui:4200/mfe/workspace/')
  })

  it('creates default entry and base URLs when the import data omits both', async () => {
    const uiEntries: UiEntryMap = {
      [appid]: { alias: 'workspace-ui', port: 4200 },
    }
    readFileMock.mockResolvedValue(JSON.stringify({}))

    await importMicrofrontends('/data', 'http://ps:8080', productStorePort, uiEntries)

    expect(putPayload().remoteEntry).toBe('http://workspace-ui:4200/remoteEntry.js')
    expect(putPayload().remoteBaseUrl).toBe('http://workspace-ui:4200/')
  })

  it('resolves configured entry and base paths independently', async () => {
    const uiEntries: UiEntryMap = {
      [appid]: {
        alias: 'workspace-ui',
        port: 4200,
        entry: '/path/mf-manifest.json',
        baseUrl: '/path/entrypoint-for-app',
      },
    }
    readFileMock.mockResolvedValue(JSON.stringify({ remoteEntry: '/proxy/remoteEntry.js', remoteBaseUrl: '/proxy/' }))

    await importMicrofrontends('/data', 'http://ps:8080', productStorePort, uiEntries)

    expect(putPayload().remoteEntry).toBe('http://workspace-ui:4200/path/mf-manifest.json')
    expect(putPayload().remoteBaseUrl).toBe('http://workspace-ui:4200/path/entrypoint-for-app')
  })

  it('honours a nested mf-manifest entry without changing an independent root base URL', async () => {
    const uiEntries: UiEntryMap = {
      [appid]: { alias: 'workspace-ui', port: 4200, entry: '/mfe/workspace/mf-manifest.json' },
    }
    readFileMock.mockResolvedValue(JSON.stringify({ remoteEntry: '/remoteEntry.js', remoteBaseUrl: '/' }))

    await importMicrofrontends('/data', 'http://ps:8080', productStorePort, uiEntries)

    expect(putPayload().remoteEntry).toBe('http://workspace-ui:4200/mfe/workspace/mf-manifest.json')
    expect(putPayload().remoteBaseUrl).toBe('http://workspace-ui:4200/')
  })

  it.each([
    ['mfe/workspace/mf-manifest.json', 'http://workspace-ui:4200/mfe/workspace/mf-manifest.json'],
    [
      'https://cdn.example.org/mfe/workspace/mf-manifest.json',
      'https://cdn.example.org/mfe/workspace/mf-manifest.json',
    ],
  ])('resolves configured entry %s as a URL', async (entry, expectedEntry) => {
    const uiEntries: UiEntryMap = {
      [appid]: { alias: 'workspace-ui', port: 4200, entry },
    }
    readFileMock.mockResolvedValue(
      JSON.stringify({ remoteEntry: '/mfe/workspace/remoteEntry.js', remoteBaseUrl: '/mfe/workspace/' })
    )

    await importMicrofrontends('/data', 'http://ps:8080', productStorePort, uiEntries)

    expect(putPayload().remoteEntry).toBe(expectedEntry)
    expect(putPayload().remoteBaseUrl).toBe('http://workspace-ui:4200/mfe/workspace/')
  })

  it('uses the recorded UI container alias/port (not the appid / product-store port) when configured', async () => {
    // alias deliberately differs from appid; port differs from the product-store port.
    const uiEntries: UiEntryMap = {
      [appid]: { alias: 'onecx-tenant-ui', port: 4201, entry: '/remoteEntry.js' },
    }
    readFileMock.mockResolvedValue(JSON.stringify({ remoteEntry: '/remoteEntry.js', remoteBaseUrl: '/' }))

    await importMicrofrontends('/data', 'http://ps:8080', productStorePort, uiEntries)

    expect(putPayload().remoteEntry).toBe('http://onecx-tenant-ui:4201/remoteEntry.js')
    expect(putPayload().remoteBaseUrl).toBe('http://onecx-tenant-ui:4201/')
  })

  it('prefers a configured entry and falls back to the import base path', async () => {
    const uiEntries: UiEntryMap = {
      [appid]: { alias: 'workspace-ui', port: 4200, entry: '/mfe/workspace/mf-manifest.json' },
    }
    readFileMock.mockResolvedValue(
      JSON.stringify({
        remoteEntry: 'http://explicit-host:9000/mfe/workspace/mf-manifest.json',
        remoteBaseUrl: '/mfe/workspace/',
      })
    )

    await importMicrofrontends('/data', 'http://ps:8080', productStorePort, uiEntries)

    expect(putPayload().remoteEntry).toBe('http://workspace-ui:4200/mfe/workspace/mf-manifest.json')
    expect(putPayload().remoteBaseUrl).toBe('http://workspace-ui:4200/mfe/workspace/')
  })

  it('leaves absolute remoteEntry and remoteBaseUrl untouched when nothing is configured', async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        remoteEntry: 'http://already-absolute:9000/remoteEntry.js',
        remoteBaseUrl: 'http://already-absolute:9000/',
      })
    )

    await importMicrofrontends('/data', 'http://ps:8080', productStorePort, undefined)

    expect(putPayload().remoteEntry).toBe('http://already-absolute:9000/remoteEntry.js')
    expect(putPayload().remoteBaseUrl).toBe('http://already-absolute:9000/')
  })

  it('handles a root-level entry path (no folder) so the base resolves to the root', async () => {
    const uiEntries: UiEntryMap = {
      [appid]: { alias: 'tenant-ui', port: 4202, entry: '/remoteEntry.js' },
    }
    readFileMock.mockResolvedValue(JSON.stringify({ remoteEntry: '/remoteEntry.js', remoteBaseUrl: '/' }))

    await importMicrofrontends('/data', 'http://ps:8080', productStorePort, uiEntries)

    expect(putPayload().remoteEntry).toBe('http://tenant-ui:4202/remoteEntry.js')
    expect(putPayload().remoteBaseUrl).toBe('http://tenant-ui:4202/')
  })
})
