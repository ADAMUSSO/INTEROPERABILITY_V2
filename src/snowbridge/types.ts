// src/snowbridge/types.ts
export type Env = 'local_e2e' | 'paseo_sepolia' | 'westend_sepolia' | 'polkadot_mainnet';
export type Direction = 'eth_to_dot' | 'dot_to_eth';

export type TokenInfo = { symbol: string; address: string; decimals?: number };

export function envLabel(env: Env) {
  switch (env) {
    case 'local_e2e':        return { evm: 'Local EVM',   dot: 'Local Polkadot' };
    case 'paseo_sepolia':    return { evm: 'Sepolia',     dot: 'Paseo' };
    case 'westend_sepolia':  return { evm: 'Sepolia',     dot: 'Westend' };
    case 'polkadot_mainnet': return { evm: 'Ethereum',    dot: 'Polkadot' };
    default:                 return { evm: 'EVM',         dot: 'Polkadot' };
  }
}
