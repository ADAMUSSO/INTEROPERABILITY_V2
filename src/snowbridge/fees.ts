// src/snowbridge/fees.ts
import { Context, contextConfigFor, toPolkadotV2, toEthereumV2 } from '@snowbridge/api';
import { getAssetRegistry } from './registry';
import type { Direction, Env, TokenInfo } from './types';

export function makeContext(env: Env) {
  return new Context(contextConfigFor(env));
}

export async function filterSupportedForRoute(
  env: Env,
  direction: Direction,
  paraId: number,
  tokens: TokenInfo[]
) {
  const context  = makeContext(env);
  const registry = getAssetRegistry(env);
  const supported: TokenInfo[] = [];

  for (const t of tokens) {
    try {
      if (direction === 'eth_to_dot') {
        await toPolkadotV2.getDeliveryFee(context, registry, t.address, paraId);
      } else {
        await toEthereumV2.getDeliveryFee(context, paraId, registry, t.address);
      }
      supported.push(t);
    } catch {
      // skip
    }
  }
  return supported;
}
