// src/snowbridge/tokens.ts
import type { Direction, TokenInfo } from './types';
import { isHexAddress } from './utils';

/** Z JSON registry (EVM + voliteľne parachain assets) */
export function tokensFromRegistryJson(reg: any, _direction: Direction, paraId?: number): TokenInfo[] {
  const out: TokenInfo[] = [];
  const seen = new Set<string>();
  const isAddr = (v: any) => typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/.test(v);

  const evmChains = reg?.ethereumChains;
  if (evmChains && typeof evmChains === 'object') {
    for (const chainKey of Object.keys(evmChains)) {
      const assets = evmChains[chainKey]?.assets;
      if (!assets) continue;
      for (const [addr, meta] of Object.entries<any>(assets)) {
        if (!isAddr(addr)) continue;
        const sym = meta?.symbol ? String(meta.symbol) : 'TOKEN';
        const dec = typeof meta?.decimals === 'number' ? meta.decimals : undefined;
        const lower = addr.toLowerCase();
        if (!seen.has(lower)) {
          out.push({ symbol: sym.toUpperCase(), address: lower, decimals: dec });
          seen.add(lower);
        }
      }
    }
  }

  if (paraId != null) {
    const pa = reg?.parachains?.[String(paraId)]?.assets;
    if (pa && typeof pa === 'object') {
      for (const [addr, meta] of Object.entries<any>(pa)) {
        if (!isAddr(addr)) continue;
        const sym = meta?.symbol ? String(meta.symbol) : 'TOKEN';
        const dec = typeof meta?.decimals === 'number' ? meta.decimals : undefined;
        const lower = addr.toLowerCase();
        if (!seen.has(lower)) {
          out.push({ symbol: sym.toUpperCase(), address: lower, decimals: dec });
          seen.add(lower);
        }
      }
    }
  }
  return out;
}

/** Fallback: hlboký prechod cez assetRegistry objekt */
export function tokensFromRegistryObject(reg: any): TokenInfo[] {
  const out: TokenInfo[] = [];
  const seen = new Set<string>();

  function walk(node: any, keyHint?: string) {
    if (!node || typeof node !== 'object') return;
    const addr: unknown = node.address ?? node.contract ?? node.erc20;
    const sym: unknown  = node.symbol ?? keyHint;
    const dec: unknown  = node.decimals;
    if (typeof addr === 'string' && isHexAddress(addr)) {
      const lower = addr.toLowerCase();
      if (!seen.has(lower)) {
        out.push({
          symbol: String(sym ?? 'TOKEN').toUpperCase(),
          address: lower,
          decimals: typeof dec === 'number' ? dec : undefined
        });
        seen.add(lower);
      }
    }
    for (const [k, v] of Object.entries(node)) {
      if (v && typeof v === 'object') walk(v, k);
    }
  }
  walk(reg);
  return out;
}
