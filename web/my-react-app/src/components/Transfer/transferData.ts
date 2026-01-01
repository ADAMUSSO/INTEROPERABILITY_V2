// src/components/Transfer/transferData.ts
import type { Env } from './types';
import type { ChainOption, ChainsForEnv, ChainOptionMap, TokenInfo } from './sharedTypes';

/* ===================== Constants ===================== */

export const HUB_LABEL_BY_ENV: Record<Env, string> = {
  paseo_sepolia: 'Paseo AssetHub (1000)',
  westend_sepolia: 'Westend AssetHub (1000)',
  polkadot_mainnet: 'Polkadot AssetHub (1000)',
};

const HUB_PARA_ID_BY_ENV: Record<Env, number> = {
  paseo_sepolia: 1000,
  westend_sepolia: 1000,
  polkadot_mainnet: 1000,
};

function evmLabelForEnv(env: Env): string {
  return env === 'polkadot_mainnet' ? 'Ethereum' : 'Sepolia';
}

/* ===================== Paraspell ===================== */

async function getParaspellChainsForEnv(env: Env): Promise<string[]> {
  try {
    const sdk = await import('@paraspell/sdk');
    const CHAINS: string[] = (sdk as any).CHAINS ?? [];
    const allChains = [...CHAINS];

    const lc = (s: string) => s.toLowerCase();

    switch (env) {
      case 'paseo_sepolia':
        return allChains.filter((c) => lc(c).includes('paseo'));
      case 'westend_sepolia':
        return allChains.filter((c) => lc(c).includes('westend'));
      case 'polkadot_mainnet':
        return allChains.filter((c) => !lc(c).includes('paseo') && !lc(c).includes('westend'));
      default:
        return [];
    }
  } catch (e) {
    console.error('[Transfer] Failed to load Paraspell CHAINS:', e);
    return [];
  }
}

/* ===================== Snowbridge registry ===================== */

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

  // malé čistenie: prázdne symboly von
  return tokens.filter((t) => (t.symbol ?? '').trim().length > 0);
}

/* ===================== Helpers ===================== */

function uniqByLabel(options: ChainOption[]): ChainOption[] {
  const seen = new Set<string>();
  const out: ChainOption[] = [];
  for (const o of options) {
    if (seen.has(o.label)) continue;
    seen.add(o.label);
    out.push(o);
  }
  return out;
}

function baseNameFromParaLabel(label: string): string {
  // "Neuro Testnet (2043)" -> "neuro testnet"
  return label.replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase();
}

/* ===================== Public loader ===================== */

export async function fetchTransferDataForEnv(
  env: Env,
): Promise<{ data: ChainsForEnv; map: ChainOptionMap }> {
  const reg = await loadRegistryJson(env);

  const hubLabel = HUB_LABEL_BY_ENV[env];
  const hubParaId = HUB_PARA_ID_BY_ENV[env];

  // SOURCE: EVM + AssetHub (aby si vedel robiť paraspell-only testy)
  const sourceChains: ChainOption[] = [
    { kind: 'evm', label: evmLabelForEnv(env) },
    { kind: 'snowbridge_para', label: hubLabel, parachainId: hubParaId },
  ];

  // DEST: snowbridge parachains z registry
  let destChains: ChainOption[] = [];
  if (reg?.parachains && typeof reg.parachains === 'object') {
    destChains = Object.entries<any>(reg.parachains).map(([pidStr, meta]) => {
      const pid = Number(pidStr);
      return {
        kind: 'snowbridge_para' as const,
        label: labelForPara(env, pid, meta),
        parachainId: pid,
      };
    });
  }

  // fallback, keď registry nedá parachains
  if (destChains.length === 0) {
    destChains.push({ kind: 'snowbridge_para', label: hubLabel, parachainId: hubParaId });
  }

  // sort snowbridge parachains
  destChains.sort((a, b) => {
    if (a.kind !== 'snowbridge_para' || b.kind !== 'snowbridge_para') return 0;
    return a.parachainId - b.parachainId;
  });

  // PARASPELL dest: pridáme XCM destinácie "via hub"
  // ale: nech neduplikujeme veci, ktoré už existujú ako Snowbridge parachain (napr. "Paseo Asset Hub", a pod.)
  const paraspellChains = await getParaspellChainsForEnv(env);

  const snowbridgeBaseNames = new Set(
    destChains
      .filter((d) => d.kind === 'snowbridge_para')
      .map((d) => baseNameFromParaLabel(d.label)),
  );

  for (const name of paraspellChains) {
    const base = name.trim().toLowerCase();

    // ak už existuje snowbridge parachain s rovnakým názvom, nepushuj paraspell variant
    if (snowbridgeBaseNames.has(base)) continue;

    destChains.push({
      kind: 'paraspell',
      label: `${name} (via ${hubLabel})`,
      chainName: name,
      viaHubLabel: hubLabel,
    });
  }

  // ešte raz dedupe (pre prípad rovnakých labelov)
  destChains = uniqByLabel(destChains);

  const tokens = extractTokensFromRegistryJson(reg);

  // map: label -> option (stále používaš label ako key v UI)
  const map: ChainOptionMap = {};
  for (const o of [...sourceChains, ...destChains]) {
    map[o.label] = o;
  }

  return { data: { sourceChains, destChains, tokens }, map };
}
