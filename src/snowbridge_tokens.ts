// src/snowbridge_tokens.ts
import { assetRegistryFor } from '@snowbridge/registry';

export type Env =
  | 'local_e2e'
  | 'paseo_sepolia'
  | 'westend_sepolia'
  | 'polkadot_mainnet';

export type TokenInfo = {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  origin: 'evm' | 'parachain';
  parachainId?: number;
};

export function extractTokens(env: Env): TokenInfo[] {
  const reg = assetRegistryFor(env);
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

// 🔹 NOVÉ: jednoduchý prehľad parachainov pre daný env
export type SnowbridgeParachainInfo = {
  paraId: number;
  name: string;
};

export function getSnowbridgeParachains(env: Env): SnowbridgeParachainInfo[] {
  const reg = assetRegistryFor(env);
  const parachains = reg.parachains ?? {};

  return Object.keys(parachains).map((key) => {
    const p = parachains[key];
    const name =
      p.info?.name ??
      p.info?.specName ??
      `Parachain ${p.parachainId}`;
    return {
      paraId: p.parachainId,
      name,
    };
  });
}

export function printExtractedTokens(env: Env): void {
  const tokens = extractTokens(env);

  console.log(`\n===== SNOWBRIDGE TOKENS FOR ENV: ${env} =====\n`);

  const evm = tokens.filter(t => t.origin === 'evm');
  const para = tokens.filter(t => t.origin === 'parachain');

  if (evm.length) {
    const grouped = groupBy(evm, t => t.chainId);
    for (const chainId of Object.keys(grouped)) {
      console.log(`=== Ethereum chain ${chainId} ===`);
      for (const t of grouped[chainId]) {
        console.log(
          `${t.symbol.padEnd(6)} ${t.name.padEnd(20)} decimals:${String(t.decimals).padEnd(2)}  address:${t.address}`,
        );
      }
      console.log();
    }
  }

  if (para.length) {
    const grouped = groupBy(para, t => t.parachainId!);
    for (const paraId of Object.keys(grouped)) {
      console.log(`=== Parachain ${paraId} ===`);
      for (const t of grouped[paraId]) {
        console.log(
          `${t.symbol.padEnd(6)} ${t.name.padEnd(20)} decimals:${String(t.decimals).padEnd(2)}  address:${t.address}`,
        );
      }
      console.log();
    }
  }

  console.log(`=============================================\n`);
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string | number) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] ||= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
