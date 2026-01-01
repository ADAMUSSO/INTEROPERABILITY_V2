// src/components/Transfer/transferData.ts
import type { Env } from './types';
import type { ChainOption, ChainsForEnv, ChainOptionMap, TokenInfo } from './sharedTypes';

/* ===================== Paraspell ===================== */

async function getParaspellChainsForEnv(env: Env): Promise<string[]> {
  try {
    const sdk = await import('@paraspell/sdk');
    const CHAINS: string[] = (sdk as any).CHAINS ?? [];
    const allChains = [...CHAINS];

    switch (env) {
      case 'paseo_sepolia':
        return allChains.filter((c) => c.toLowerCase().includes('paseo'));
      case 'westend_sepolia':
        return allChains.filter((c) => c.toLowerCase().includes('westend'));
      case 'polkadot_mainnet':
        return allChains.filter(
          (c) => !c.toLowerCase().includes('paseo') && !c.toLowerCase().includes('westend'),
        );
      default:
        return [];
    }
  } catch (e) {
    console.error('[Transfer] Failed to load Paraspell CHAINS:', e);
    return [];
  }
}

/* ===================== Snowbridge registry ===================== */

function evmLabelForEnv(env: Env): string {
  return env === 'polkadot_mainnet' ? 'Ethereum' : 'Sepolia';
}

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

const FALLBACK_PARA_NAMES: Partial<Record<Env, Record<number, string>>> = {
  paseo_sepolia: { 1000: 'AssetHub (Paseo)' },
  westend_sepolia: { 1000: 'AssetHub (Westend)' },
  polkadot_mainnet: { 1000: 'AssetHub' },
};

export const HUB_LABEL_BY_ENV: Partial<Record<Env, string>> = {
  paseo_sepolia: 'Paseo AssetHub (1000)',
  westend_sepolia: 'Westend AssetHub (1000)',
  polkadot_mainnet: 'Polkadot AssetHub (1000)',
};

function labelForPara(env: Env, pid: number, meta: any): string {
  const fromMeta = extractParaName(meta);
  const fromFallback = FALLBACK_PARA_NAMES[env]?.[pid];
  const name = fromMeta || fromFallback || 'Parachain';
  return `${name} (${pid})`;
}

async function loadRegistryJson(env: Env): Promise<any | null> {
  try {
    if (env === 'paseo_sepolia') {
      const mod = await import('@snowbridge/registry/dist/paseo_sepolia.registry.json');
      return (mod as any).default ?? mod;
    }
    if (env === 'westend_sepolia') {
      const mod = await import('@snowbridge/registry/dist/westend_sepolia.registry.json');
      return (mod as any).default ?? mod;
    }
    if (env === 'polkadot_mainnet') {
      const mod = await import('@snowbridge/registry/dist/polkadot_mainnet.registry.json');
      return (mod as any).default ?? mod;
    }
    return null;
  } catch (e) {
    console.error('[Transfer] Failed to load registry JSON for env=', env, e);
    return null;
  }
}

function extractTokensFromRegistryJson(reg: any): TokenInfo[] {
  if (!reg) return [];

  const tokens: TokenInfo[] = [];

  const ethChains = reg.ethereumChains ?? {};
  for (const chainKey of Object.keys(ethChains)) {
    const chain = ethChains[chainKey];
    const assets = chain.assets ?? {};
    for (const [address, meta] of Object.entries<any>(assets)) {
      tokens.push({
        chainId: chain.chainId,
        address,
        name: meta.name ?? '',
        symbol: meta.symbol ?? '',
        decimals: meta.decimals ?? 0,
        origin: 'evm',
      });
    }
  }

  const parachains = reg.parachains ?? {};
  for (const paraKey of Object.keys(parachains)) {
    const para = parachains[paraKey];
    const assets = para.assets ?? {};
    for (const [address, meta] of Object.entries<any>(assets)) {
      tokens.push({
        chainId: para.parachainId,
        address,
        name: meta.name ?? '',
        symbol: meta.symbol ?? '',
        decimals: meta.decimals ?? 0,
        origin: 'parachain',
        parachainId: para.parachainId,
      });
    }
  }

  return tokens;
}

/* ===================== Public loader ===================== */

export async function fetchTransferDataForEnv(
  env: Env,
): Promise<{ data: ChainsForEnv; map: ChainOptionMap }> {
  const reg = await loadRegistryJson(env);

  const sourceChains: ChainOption[] = [{ kind: 'evm', label: evmLabelForEnv(env) }];

  const destChains: ChainOption[] = [];
  if (reg?.parachains && typeof reg.parachains === 'object') {
    for (const [pidStr, meta] of Object.entries<any>(reg.parachains)) {
      const pid = Number(pidStr);
      destChains.push({
        kind: 'snowbridge_para',
        label: labelForPara(env, pid, meta),
        parachainId: pid,
      });
    }
  }

  if (!destChains.length) {
    const fallbackLabel =
      env === 'paseo_sepolia'
        ? 'Paseo AssetHub (1000)'
        : env === 'westend_sepolia'
          ? 'Westend AssetHub (1000)'
          : 'Polkadot AssetHub (1000)';

    destChains.push({ kind: 'snowbridge_para', label: fallbackLabel, parachainId: 1000 });
  }

  destChains.sort((a, b) => {
    if (a.kind !== 'snowbridge_para' || b.kind !== 'snowbridge_para') return 0;
    return a.parachainId - b.parachainId;
  });

  const paraspellChains = await getParaspellChainsForEnv(env);
  const hubLabel = HUB_LABEL_BY_ENV[env] ?? 'AssetHub';

  for (const name of paraspellChains) {
    destChains.push({
      kind: 'paraspell',
      label: `${name} (via ${hubLabel})`,
      chainName: name,
      viaHubLabel: hubLabel,
    });
  }

  const tokens = extractTokensFromRegistryJson(reg);

  const map: ChainOptionMap = {};
  for (const o of [...sourceChains, ...destChains]) map[o.label] = o;

  return { data: { sourceChains, destChains, tokens }, map };
}
