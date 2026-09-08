const SAFE_NETWORK_ALIAS = /^[a-zA-Z0-9._-]+$/

export function validateNetworkAlias(networkAlias: string, containerType = 'container'): void {
  if (!SAFE_NETWORK_ALIAS.test(networkAlias) || networkAlias.includes('..')) {
    throw new Error(`${containerType} network alias is not a safe name: ${networkAlias}`)
  }
}
