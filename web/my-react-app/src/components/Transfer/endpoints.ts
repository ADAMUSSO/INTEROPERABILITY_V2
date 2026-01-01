// src/components/Transfer/endpoints.ts
import type { Env } from './types';

// WS pre AssetHub – MUSÍ byť reálny.
// Daj sem svoje vlastné (napr. z dokumentácie/testnet RPC providerov).
export const ASSET_HUB_WS: Record<Env, string> = {
  paseo_sepolia: 'wss://asset-hub-paseo-rpc.n.dwellir.com',
  westend_sepolia: 'wss://westend-asset-hub-rpc.polkadot.io',
  polkadot_mainnet: 'wss://sys.ibp.network/asset-hub-polkadot',
};

// Ako sa AssetHub volá v ParaSpell CHAINS (uprav podľa toho čo vidíš v dropdown)
export const ASSET_HUB_PARASPELL_NAME: Record<Env, string> = {
  paseo_sepolia: 'AssetHubPaseo',
  westend_sepolia: 'AssetHubWestend',
  polkadot_mainnet: 'AssetHubPolkadot',
};

// AssetHub paraId (štandardne 1000)
export const ASSET_HUB_PARA_ID = 1000;
