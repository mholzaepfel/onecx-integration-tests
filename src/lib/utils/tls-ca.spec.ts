import { X509Certificate } from 'node:crypto'
import { getCaCertificatePem, issueCertificateFor } from './tls-ca'

describe('tls-ca', () => {
  it('issues a leaf certificate with the requested SAN hostnames, signed by the exported CA', async () => {
    const { cert, key } = await issueCertificateFor(['onecx-announcement-ui', 'localhost'])

    expect(cert).toContain('-----BEGIN CERTIFICATE-----')
    expect(key).toContain('-----BEGIN PRIVATE KEY-----')

    const parsed = new X509Certificate(cert)
    expect(parsed.subjectAltName).toBe('DNS:onecx-announcement-ui, DNS:localhost')
    expect(parsed.subject).toBe('CN=onecx-announcement-ui')

    const caPem = await getCaCertificatePem()
    const caParsed = new X509Certificate(caPem)
    expect(parsed.checkIssued(caParsed)).toBe(true)
  })

  it('issues different certificates for different hostnames from the same shared CA', async () => {
    const shell = await issueCertificateFor(['onecx-shell-ui', 'localhost'])
    const workspace = await issueCertificateFor(['onecx-workspace-ui', 'localhost'])

    const shellCert = new X509Certificate(shell.cert)
    const workspaceCert = new X509Certificate(workspace.cert)

    expect(shellCert.subject).toBe('CN=onecx-shell-ui')
    expect(workspaceCert.subject).toBe('CN=onecx-workspace-ui')
    expect(shellCert.issuer).toBe(workspaceCert.issuer)
  })
})
