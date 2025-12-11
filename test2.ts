import { assetRegistryFor } from '@snowbridge/registry';
import {
  CHAINS,
  getAssetsObject,
  type TChain,
} from '@paraspell/sdk';


//PARASPELL
export function getParaspellChains(): TChain[] {
  // CHAINS je pole stringov, priamo zo SDK docs
  return [...CHAINS] as TChain[];
}


// Len pekný výpis do konzoly
export function printParaspellChains(): void {
  const chains = getParaspellChains();

  console.log('\n===== ParaSpell CHAINS =====');
  for (const c of chains) {
    console.log(`- ${c}`);
  }
  console.log('============================\n');
}



export type ParaspellTokenInfo = {
  chain: TChain;
  symbol: string;
  decimals: number;
  existentialDeposit: string;
  isNative: boolean;
  assetId?: string;  // pre foreign assets
};



export function getParaspellTokensForChain(chain: TChain): ParaspellTokenInfo[] {
  const assetsObj = getAssetsObject(chain);

  const native = (assetsObj.nativeAssets ?? []).map((a: any) => ({
    chain,
    symbol: a.symbol,
    decimals: a.decimals,
    existentialDeposit: a.existentialDeposit,
    isNative: true,
    assetId: a.assetId, // väčšinou tu nebude, ale keby
  })) as ParaspellTokenInfo[];

  const foreign = (assetsObj.otherAssets ?? []).map((a: any) => ({
    chain,
    symbol: a.symbol,
    decimals: a.decimals,
    existentialDeposit: a.existentialDeposit,
    isNative: false,
    assetId: a.assetId,   // tu býva reálne assetId
  })) as ParaspellTokenInfo[];

  return [...native, ...foreign];
}



export function printParaspellTokensForChain(chain: TChain): void {
  const tokens = getParaspellTokensForChain(chain);

  console.log(`\n===== TOKENS FOR PARASPELL CHAIN: ${chain} =====\n`);

  const native = tokens.filter(t => t.isNative);
  const foreign = tokens.filter(t => !t.isNative);

  if (native.length) {
    console.log('--- Native assets ---');
    for (const t of native) {
      console.log(
        `${t.symbol.padEnd(8)} decimals: ${String(t.decimals).padEnd(2)}  ED: ${t.existentialDeposit}`
      );
    }
    console.log();
  }

  if (foreign.length) {
    console.log('--- Foreign assets ---');
    for (const t of foreign) {
      console.log(
        `${t.symbol.padEnd(8)} decimals: ${String(t.decimals).padEnd(2)}  ED: ${t.existentialDeposit}` +
        (t.assetId ? `  assetId: ${t.assetId}` : '')
      );
    }
    console.log();
  }

  console.log('===============================================\n');
}




//SNOWBRIDGE
type Env =
  | 'local_e2e'
  | 'paseo_sepolia'
  | 'westend_sepolia'
  | 'polkadot_mainnet';


// Struktúra jedného tokenu
type TokenInfo = {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  origin: 'evm' | 'parachain';
  parachainId?: number;
};

// Vyextrahuje všetky tokeny z assetRegistryFor(env)
export function extractTokens(env: Env): TokenInfo[] {
  const reg = assetRegistryFor(env);
  const tokens: TokenInfo[] = [];

  // --- 1) Ethereum chains ---
  const ethChains = reg.ethereumChains ?? {};
  for (const chainKey of Object.keys(ethChains)) {
    const chain = ethChains[chainKey];
    const assets = chain.assets ?? {};

    for (const [address, meta] of Object.entries<any>(assets)) {
      tokens.push({
        chainId: chain.chainId,
        address: address,
        name: meta.name ?? '',
        symbol: meta.symbol ?? '',
        decimals: meta.decimals ?? 0,
        origin: 'evm',
      });
    }
  }

  // --- 2) Parachain assets ---
  const parachains = reg.parachains ?? {};
  for (const paraKey of Object.keys(parachains)) {
    const para = parachains[paraKey];
    const assets = para.assets ?? {};

    for (const [address, meta] of Object.entries<any>(assets)) {
      tokens.push({
        chainId: para.parachainId,
        address: address,
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

// Pekný výpis do konzoly
export function printExtractedTokens(env: Env): void {
  const tokens = extractTokens(env);

  console.log(`\n===== TOKENS FOR ENV: ${env} =====\n`);

  // EVM tokeny podľa chainId
  const evm = tokens.filter(t => t.origin === 'evm');
  const para = tokens.filter(t => t.origin === 'parachain');

  // -------- ETHEREUM TOKENS --------
  if (evm.length) {
    const grouped = groupBy(evm, t => t.chainId);

    for (const chainId of Object.keys(grouped)) {
      console.log(`=== Ethereum chain ${chainId} ===`);
      for (const t of grouped[chainId]) {
        console.log(
          `${t.symbol.padEnd(6)} ${t.name.padEnd(20)} decimals: ${String(t.decimals).padEnd(2)} address: ${t.address}`
        );
      }
      console.log();
    }
  }

  // -------- PARACHAINS TOKENS --------
  if (para.length) {
    const grouped = groupBy(para, t => t.parachainId!);

    for (const paraId of Object.keys(grouped)) {
      console.log(`=== Parachain ${paraId} ===`);
      for (const t of grouped[paraId]) {
        console.log(
          `${t.symbol.padEnd(6)} ${t.name.padEnd(20)} decimals: ${String(t.decimals).padEnd(2)} address: ${t.address}`
        );
      }
      console.log();
    }
  }

  console.log(`====================================\n`);
}

// Helper: groupBy
function groupBy<T>(arr: T[], getKey: (item: T) => string | number) {
  return arr.reduce((acc, item) => {
    const key = getKey(item);
    (acc[key] ||= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

const env: Env = 'paseo_sepolia'; // alebo iný z: 'local_e2e' | 'westend_sepolia' | 'polkadot_mainnet'
printExtractedTokens(env);


