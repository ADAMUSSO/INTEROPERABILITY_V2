// src/components/Transfer/sharedTypes.ts
export type TokenInfo = {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  origin: 'evm' | 'parachain';
  parachainId?: number;
};

export type ChainOption =
  | { kind: 'evm'; label: string }
  | { kind: 'snowbridge_para'; label: string; parachainId: number }
  | { kind: 'paraspell'; label: string; chainName: string; viaHubLabel: string };

export type ChainsForEnv = {
  sourceChains: ChainOption[];
  destChains: ChainOption[];
  tokens: TokenInfo[];
};

export type ChainOptionMap = Record<string, ChainOption>;

export type PreparedTransfer = {
  env: import('./types').Env;
  source: ChainOption; // evm
  dest: ChainOption;   // snowbridge_para | paraspell
  sourceAddress: string; // EVM (0x..)
  destAddress: string;   // Substrate (SS58)
  token: TokenInfo;
  amountHuman: string;
  amountBase: bigint;
};
