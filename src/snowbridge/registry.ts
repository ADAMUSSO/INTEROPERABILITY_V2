// src/snowbridge/registry.ts
import fs from 'fs';
import { assetRegistryFor } from '@snowbridge/registry';
import type { Env } from './types';

export function registryJsonPath(env: Env): string | null {
  const file =
    env === 'local_e2e'       ? 'local_e2e.registry.json' :
    env === 'paseo_sepolia'   ? 'paseo_sepolia.registry.json' :
    env === 'westend_sepolia' ? 'westend_sepolia.registry.json' :
                                'polkadot_mainnet.registry.json';
  try {
    return require.resolve(`@snowbridge/registry/dist/${file}`);
  } catch {
    return null;
  }
}

export function readRegistryJson(env: Env): any | null {
  const p = registryJsonPath(env);
  if (!p) return null;
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getAssetRegistry(env: Env) {
  return assetRegistryFor(env);
}

// ------- UI labels for parachains --------
function extractParaName(meta: any): string | undefined {
  return (
    meta?.name ||
    meta?.display ||
    meta?.chainName ||
    meta?.parachainName ||
    meta?.metadata?.name ||
    meta?.info?.name ||
    meta?.id ||
    undefined
  );
}

const FALLBACK_PARA_NAMES: Record<Env, Record<number, string>> = {
  local_e2e: { 1000: 'AssetHub (local)' },
  paseo_sepolia: { 1000: 'AssetHub (Paseo)' },
  westend_sepolia: { 1000: 'AssetHub (Westend)' },
  polkadot_mainnet: { 1000: 'AssetHub' }
};

function labelForPara(env: Env, pid: number, meta: any): string {
  const fromMeta = extractParaName(meta);
  const fromFallback = FALLBACK_PARA_NAMES[env]?.[pid];
  const name = fromMeta || fromFallback || 'Parachain';
  return `${name} (${pid})`;
}

export function listParachainChoices(env: Env): { title: string; value: number }[] {
  const reg = readRegistryJson(env);
  if (!reg?.parachains || typeof reg.parachains !== 'object') return [];
  return Object.entries<any>(reg.parachains)
    .map(([pidStr, meta]) => ({ title: labelForPara(env, Number(pidStr), meta), value: Number(pidStr) }))
    .sort((a, b) => a.value - b.value);
}
