// src/paraspell_tokens.ts
import {
  CHAINS,
  getAssetsObject,
  type TChain,
} from '@paraspell/sdk';

export function getParaspellChains(): TChain[] {
  return [...CHAINS] as TChain[];
}

export function printParaspellChains(): void {
  const chains = getParaspellChains();
  console.log('\n===== PARASPELL CHAINS =====');
  for (const c of chains) console.log(`- ${c}`);
  console.log('============================\n');
}

export type ParaspellTokenInfo = {
  chain: TChain;
  symbol: string;
  decimals: number;
  existentialDeposit: string;
  isNative: boolean;
  assetId?: string;
};

export function getParaspellTokensForChain(chain: TChain): ParaspellTokenInfo[] {
  const assets = getAssetsObject(chain);

  const native = (assets.nativeAssets ?? []).map((a: any) => ({
    chain,
    symbol: a.symbol,
    decimals: a.decimals,
    existentialDeposit: a.existentialDeposit,
    isNative: true,
    assetId: a.assetId,
  }));

  const foreign = (assets.otherAssets ?? []).map((a: any) => ({
    chain,
    symbol: a.symbol,
    decimals: a.decimals,
    existentialDeposit: a.existentialDeposit,
    isNative: false,
    assetId: a.assetId,
  }));

  return [...native, ...foreign];
}

export function printParaspellTokensForChain(chain: TChain): void {
  const tokens = getParaspellTokensForChain(chain);

  console.log(`\n===== PARASPELL TOKENS FOR CHAIN: ${chain} =====\n`);

  const native = tokens.filter(t => t.isNative);
  const foreign = tokens.filter(t => !t.isNative);

  if (native.length) {
    console.log("--- Native assets ---");
    native.forEach(t =>
      console.log(`${t.symbol.padEnd(8)} decimals:${String(t.decimals).padEnd(2)}  ED:${t.existentialDeposit}`)
    );
    console.log();
  }

  if (foreign.length) {
    console.log("--- Foreign assets ---");
    foreign.forEach(t =>
      console.log(`${t.symbol.padEnd(8)} decimals:${String(t.decimals).padEnd(2)}  ED:${t.existentialDeposit}  assetId:${t.assetId}`)
    );
    console.log();
  }

  console.log("================================================\n");
}
