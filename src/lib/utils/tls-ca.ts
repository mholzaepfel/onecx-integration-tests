import 'reflect-metadata'
import { webcrypto } from 'node:crypto'
import * as x509 from '@peculiar/x509'

x509.cryptoProvider.set(webcrypto as unknown as Crypto)

export interface IssuedCertificate {
  cert: string
  key: string
}

// RSA 2048/SHA-256 for broad TLS stack compatibility (Chromium, Node, Keycloak's embedded server).
const SIGNING_ALGORITHM: RsaHashedKeyGenParams = {
  name: 'RSASSA-PKCS1-v1_5',
  hash: 'SHA-256',
  publicExponent: new Uint8Array([1, 0, 1]),
  modulusLength: 2048,
}

// Ephemeral, regenerated every process start; never persisted or reused across runs.
const VALID_FROM = new Date()
const VALID_UNTIL = new Date(VALID_FROM.getTime() + 1000 * 60 * 60 * 24 * 365)

interface CertificateAuthority {
  cert: x509.X509Certificate
  keys: CryptoKeyPair
}

let ca: Promise<CertificateAuthority> | undefined

function randomSerial(): string {
  return Array.from(webcrypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function createCa(): Promise<CertificateAuthority> {
  const keys = await webcrypto.subtle.generateKey(SIGNING_ALGORITHM, true, ['sign', 'verify'])
  const cert = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: randomSerial(),
    name: 'CN=OneCX Integration Tests Ephemeral CA',
    notBefore: VALID_FROM,
    notAfter: VALID_UNTIL,
    signingAlgorithm: SIGNING_ALGORITHM,
    keys,
    extensions: [
      new x509.BasicConstraintsExtension(true, undefined, true),
      new x509.KeyUsagesExtension(x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign, true),
      await x509.SubjectKeyIdentifierExtension.create(keys.publicKey),
    ],
  })
  return { cert, keys }
}

function getCa(): Promise<CertificateAuthority> {
  if (!ca) {
    ca = createCa()
  }
  return ca
}

/** PEM of the shared ephemeral CA that signs every per-alias leaf certificate below; export this for consumers to trust. */
export async function getCaCertificatePem(): Promise<string> {
  const { cert } = await getCa()
  return cert.toString('pem')
}

/** Issues a TLS server certificate signed by the shared ephemeral CA, with a SAN entry per given hostname. */
export async function issueCertificateFor(hostnames: string[]): Promise<IssuedCertificate> {
  const authority = await getCa()
  const keys = await webcrypto.subtle.generateKey(SIGNING_ALGORITHM, true, ['sign', 'verify'])

  const cert = await x509.X509CertificateGenerator.create({
    serialNumber: randomSerial(),
    subject: `CN=${hostnames[0]}`,
    issuer: authority.cert.subject,
    notBefore: VALID_FROM,
    notAfter: VALID_UNTIL,
    signingAlgorithm: SIGNING_ALGORITHM,
    publicKey: keys.publicKey,
    signingKey: authority.keys.privateKey,
    extensions: [
      new x509.BasicConstraintsExtension(false),
      new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.keyEncipherment, true),
      new x509.ExtendedKeyUsageExtension([x509.ExtendedKeyUsage.serverAuth]),
      new x509.SubjectAlternativeNameExtension(hostnames.map((value) => ({ type: x509.DNS, value }) as const)),
    ],
  })

  const keyBuffer = await webcrypto.subtle.exportKey('pkcs8', keys.privateKey)
  const key = x509.PemConverter.encode(keyBuffer, x509.PemConverter.PrivateKeyTag)

  return { cert: cert.toString('pem'), key }
}
