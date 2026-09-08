import { validateNetworkAlias } from '../../utils/network-alias.utils'

describe('validateNetworkAlias', () => {
  it('accepts safe artifact directory names', () => {
    expect(() => validateNetworkAlias('shell-e2e_01.v2')).not.toThrow()
  })

  it.each(['../../outside', 'suite/name', 'suite\\name'])('rejects unsafe alias %s', (alias) => {
    expect(() => validateNetworkAlias(alias)).toThrow('not a safe name')
  })
})
