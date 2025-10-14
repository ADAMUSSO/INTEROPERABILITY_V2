// select_cli.ts
// Spustenie: ts-node select_cli.ts

import prompts from 'prompts';
import { Context, contextConfigFor, toPolkadotV2, toEthereumV2 } from '@snowbridge/api';
import { assetRegistryFor } from '@snowbridge/registry';
import fs from 'fs';
import { exit } from 'process';
import 'dotenv/config';
import { ethers } from 'ethers';





type Env = 'local_e2e' | 'paseo_sepolia' | 'westend_sepolia' | 'polkadot_mainnet';
type Direction = 'eth_to_dot' | 'dot_to_eth';
type TokenInfo = { symbol: string; address: string; decimals?: number };

function isHexAddress(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}
function isSs58(v: string) {
  return typeof v === 'string' && v.length >= 5;
}
function envLabel(env: Env) {
  switch (env) {
    case 'local_e2e':        return { evm: 'Local EVM',   dot: 'Local Polkadot' };
    case 'paseo_sepolia':    return { evm: 'Sepolia',     dot: 'Paseo' };
    case 'westend_sepolia':  return { evm: 'Sepolia',     dot: 'Westend' };
    case 'polkadot_mainnet': return { evm: 'Ethereum',    dot: 'Polkadot' };
    default:                 return { evm: 'EVM',         dot: 'Polkadot' };
  }
}

/* ---------------- Registry helpers ---------------- */


const erc20Abi = [
  'function approve(address spender, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)'
];

function getSepoliaWallet() {
  const rpc = process.env.SEPOLIA_RPC;
  const pk  = process.env.SEPOLIA_PRIVKEY;
  if (!rpc || !pk) throw new Error('Chýba SEPOLIA_RPC alebo SEPOLIA_PRIVKEY v .env');
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  return { provider, wallet };
}

async function ensureAllowance(token: string, owner: string, spender: string, need: bigint, wallet: ethers.Wallet) {
  const c = new ethers.Contract(token, erc20Abi, wallet);
  const cur: bigint = await c.allowance(owner, spender);
  if (cur >= need) return;
  const tx = await c.approve(spender, need);
  console.log('approve tx:', tx.hash);
  await tx.wait();
  console.log('approve confirmed');
}




function registryJsonPath(env: Env): string | null {
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

function readRegistryJson(env: Env): any | null {
  const p = registryJsonPath(env);
  if (!p) return null;
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Z registry JSON vyzbiera tokeny (symbol, adresa, decimals) z EVM vetiev + voliteľne z parachain vetvy */
function tokensFromRegistryJson(
  reg: any,
  direction: Direction,
  paraId?: number
): TokenInfo[] {
  const out: TokenInfo[] = [];
  const seen = new Set<string>();
  const isAddr = (v: any) => typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/.test(v);

  // EVM strana: prejdi všetky ethereumChains.*.assets
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

  // DOT/parachain strana (užitočné najmä pre DOT→ETH): parachains[paraId].assets
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

/** Fallback: prejde assetRegistryFor(env) a vyzbiera adresy + decimals ak sú */
function tokensFromRegistryObject(reg: any): TokenInfo[] {
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

/** Prefiltruje tokeny na tie, pre ktoré vieme získať fee pre danú trasu (tým pádom sú použiteľné) */
async function filterSupportedForRoute(
  env: Env,
  direction: Direction,
  paraId: number,
  tokens: TokenInfo[]
) {
  const context  = new Context(contextConfigFor(env));
  const registry = assetRegistryFor(env);
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
      // token pre danú trasu preskočíme
    }
  }
  return supported;
}

/** Bezpečný prepočet z ľudského čísla ("1.23") na base units podľa decimals -> BigInt */
function toBaseUnits(human: string, decimals: number): bigint {
  const s = human.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) {
    throw new Error('Zadaj kladné číslo, napr. 1 alebo 0.5');
  }
  const [intPart, fracPartRaw = ''] = s.split('.');
  if (fracPartRaw.length > decimals) {
    throw new Error(`Maximálne ${decimals} desatinných miest pre tento token.`);
  }
  const fracPart = fracPartRaw.padEnd(decimals, '0'); // doplníme doprava
  const combined = (intPart + fracPart).replace(/^0+/, '') || '0'; // odstráň leading zeros
  return BigInt(combined);
}

/* ---------------- MAIN ---------------- */

async function main() {
  // 1) ENV
  const envAns = await prompts({
    type: 'select',
    name: 'env',
    message: 'Vyber environment',
    initial: 1,
    choices: [
      { title: 'local_e2e (lokálne)', value: 'local_e2e' },
      { title: 'paseo_sepolia (testnet)', value: 'paseo_sepolia' },
      { title: 'westend_sepolia (testnet)', value: 'westend_sepolia' },
      { title: 'polkadot_mainnet (produkcia)', value: 'polkadot_mainnet' }
    ]
  });
  const env = envAns.env as Env;
  const { evm, dot } = envLabel(env);

  // 2) smer
  const dirAns = await prompts({
    type: 'select',
    name: 'direction',
    message: 'Smer prenosu',
    choices: [
      { title: `${evm} ➜ ${dot} (ETH → DOT)`, value: 'eth_to_dot' },
      { title: `${dot} ➜ ${evm} (DOT → ETH)`, value: 'dot_to_eth' }
    ]
  });
  const direction = dirAns.direction as Direction;

  // 3) parachain
  const paraChoice = await prompts({
    type: 'select',
    name: 'paraPreset',
    message: direction === 'eth_to_dot' ? 'Cieľový parachain (paraId)' : 'Zdrojový parachain (paraId)',
    choices: [
      { title: 'AssetHub (1000)', value: 1000 },
      { title: 'Zadať vlastné paraId…', value: -1 }
    ]
  });
  let paraId: number = paraChoice.paraPreset;
  if (paraId === -1) {
    const manual = await prompts({
      type: 'text',
      name: 'pid',
      message: 'Zadaj paraId (napr. 1000):',
      validate: (v: string) => /^\d+$/.test(v) ? true : 'Zadaj celé číslo'
    });
    paraId = Number(manual.pid);
  }

  // 4) TOKENY z registry (JSON -> fallback na objekt)
  const regJson = readRegistryJson(env);
  let candidates: TokenInfo[] =
    (regJson ? tokensFromRegistryJson(regJson, direction, paraId) : []) as TokenInfo[];

  if (candidates.length === 0) {
    const regObj = assetRegistryFor(env);
    candidates = tokensFromRegistryObject(regObj);
  }

  console.log(`[Registry] Nájdených tokenov pre ${env}: ${candidates.length}`);
  candidates = await filterSupportedForRoute(env, direction, paraId, candidates);
  console.log(`[Registry] Použiteľných pre danú trasu: ${candidates.length}`);

  let chosen: TokenInfo | null = null;

  if (candidates.length > 0) {
    const pick = await prompts({
      type: 'select',
      name: 'sel',
      message: 'Vyber token zo Snowbridge registry (alebo zadaj vlastný)',
      choices: [
        ...candidates.map(t => ({
          title: `${t.symbol}${typeof t.decimals === 'number' ? ` (decimals ${t.decimals})` : ''} — ${t.address.slice(0,6)}…${t.address.slice(-4)}`,
          value: JSON.stringify(t)
        })),
        { title: 'Zadať vlastnú ERC-20 adresu…', value: '__CUSTOM__' }
      ]
    });

    if (pick.sel === '__CUSTOM__') {
      const ans = await prompts([
        {
          type: 'text',
          name: 'addr',
          message: `Zadaj ERC-20 kontrakt (0x...) na ${evm}:`,
          validate: (v: string) => isHexAddress(v) ? true : 'Zadaj platnú 0x adresu'
        },
        {
          type: 'number',
          name: 'dec',
          message: 'Počet desatinných miest (decimals):',
          validate: (v: number) => Number.isInteger(v) && v >= 0 && v <= 36 ? true : 'Zadaj celé číslo 0–36'
        }
      ]);
      chosen = { symbol: 'CUSTOM', address: (ans.addr as string).toLowerCase(), decimals: Number(ans.dec) };
    } else {
      chosen = JSON.parse(pick.sel as string) as TokenInfo;
      chosen.address = chosen.address.toLowerCase();
      // ak decimals v registry chýba, dopýtame si ho
      if (typeof chosen.decimals !== 'number') {
        const ans = await prompts({
          type: 'number',
          name: 'dec',
          message: `Zadaj decimals pre ${chosen.symbol}:`,
          validate: (v: number) => Number.isInteger(v) && v >= 0 && v <= 36 ? true : 'Zadaj celé číslo 0–36'
        });
        chosen.decimals = Number(ans.dec);
      }
    }
  } else {
    const ans = await prompts([
      {
        type: 'text',
        name: 'addr',
        message: `Token na ${evm} – zadaj ERC-20 kontrakt (0x...):`,
        validate: (v: string) => isHexAddress(v) ? true : 'Zadaj platnú 0x adresu'
      },
      {
        type: 'number',
        name: 'dec',
        message: 'Počet desatinných miest (decimals):',
        validate: (v: number) => Number.isInteger(v) && v >= 0 && v <= 36 ? true : 'Zadaj celé číslo 0–36'
      }
    ]);
    chosen = { symbol: 'CUSTOM', address: (ans.addr as string).toLowerCase(), decimals: Number(ans.dec) };
  }

  const tokenAddress = chosen!.address;
  const tokenDecimals = chosen!.decimals as number;
  const chosenSymbol = chosen!.symbol;

  // 5) amount – používateľ zadá ľudské číslo, my ho prepočítame na base units
  let humanAmount = '';
  let amount: bigint | null = null;
  while (amount === null) {
    const a = await prompts({
      type: 'text',
      name: 'val',
      message: `Množstvo (${chosenSymbol}) v ľudských jednotkách (napr. 1.5):`,
      validate: (v: string) => v.trim().length > 0 ? true : 'Zadaj číslo'
    });
    humanAmount = String(a.val);
    try {
      amount = toBaseUnits(humanAmount, tokenDecimals);
    } catch (e: any) {
      console.log('⚠️ ', e?.message ?? 'Neplatná hodnota.');
      amount = null;
    }
  }

  // 6) adresy podľa smeru
  let fromEth = '', toEth = '', fromDot = '', toDotAddr = '';
  if (direction === 'eth_to_dot') {
    const a = await prompts([
      {
        type: 'text',
        name: 'fromEth',
        message: `Tvoja EVM adresa na ${evm} (0x...):`,
        validate: (v: string) => isHexAddress(v) ? true : 'Neplatná EVM adresa'
      },
      {
        type: 'text',
        name: 'toDot',
        message: `Cieľová ${dot} adresa (SS58):`,
        validate: (v: string) => isSs58(v) ? true : 'Neplatná SS58 adresa'
      }
    ]);
    fromEth = (a.fromEth as string).toLowerCase();
    toDotAddr = a.toDot as string;
  } else {
    const a = await prompts([
      {
        type: 'text',
        name: 'fromDot',
        message: `Tvoja ${dot} adresa (SS58):`,
        validate: (v: string) => isSs58(v) ? true : 'Neplatná SS58 adresa'
      },
      {
        type: 'text',
        name: 'toEth',
        message: `Cieľová EVM adresa na ${evm} (0x...):`,
        validate: (v: string) => isHexAddress(v) ? true : 'Neplatná EVM adresa'
      }
    ]);
    fromDot = a.fromDot as string;
    toEth = (a.toEth as string).toLowerCase();
  }

  // 7) zhrnutie
  console.log('\n================ VÝBER =================');
  console.log('ENV:        ', env);
  console.log('Smer:       ', direction === 'eth_to_dot' ? `${evm} ➜ ${dot}` : `${dot} ➜ ${evm}`);
  console.log('Parachain:  ', paraId);
  console.log('Token:      ', `${chosenSymbol} @ ${tokenAddress} (decimals ${tokenDecimals})`);
  console.log('Amount:     ', `${humanAmount} → base units = ${amount.toString()}`);
  if (direction === 'eth_to_dot') {
    console.log('From (EVM): ', fromEth);
    console.log('To (DOT):   ', toDotAddr);
  } else {
    console.log('From (DOT): ', fromDot);
    console.log('To (EVM):   ', toEth);
  }
  console.log('========================================\n');

  // ---- QUOTE -> CREATE (náhľady, nič sa neposiela) ----
  const context = new Context(contextConfigFor(env));
  const registry = assetRegistryFor(env);
  const para = Number(paraId);

  if (direction === 'eth_to_dot') {
    console.log('[QUOTE] getDeliveryFee (ETH -> DOT)...');
    const fee = await toPolkadotV2.getDeliveryFee(context, registry, tokenAddress, para);
    console.log('DeliveryFee:', fee);

    console.log('\n[CREATE] createTransfer (ETH -> DOT) – náhľad tx');
    const { tx } = await toPolkadotV2.createTransfer(
      registry, fromEth, toDotAddr, tokenAddress, para, amount, fee
    );
    console.log('EVM tx preview:', {
      to: (tx as any)?.to,
      value: (tx as any)?.value?.toString?.(),
      dataLength: (tx as any)?.data ? String((tx as any).data.length) : undefined
    });
      // ---- EXECUTE (voliteľne) ----
  const execAns = await prompts({
    type: 'confirm',
    name: 'go',
    message: 'Chceš transakciu rovno odoslať? (len ETH → DOT)',
    initial: false
  });

  if (execAns.go) {
    try {
      const { wallet } = getSepoliaWallet();
      const me = await wallet.getAddress();

      // 1) approve na gateway, ak treba
      const gateway = (tx as any)?.to as string; // 'to' z preview je gateway adresa
      await ensureAllowance(tokenAddress, me, gateway, amount, wallet);

      // 2) pošli bridgovaciu tx (presne to/value/data z preview)
      const send = await wallet.sendTransaction({
        to: gateway,
        value: (tx as any)?.value ?? BigInt(0),
        data: (tx as any)?.data
      });
      console.log('bridge tx sent:', send.hash);

      const rcpt = await send.wait();
      console.log('bridge tx confirmed in block:', rcpt?.blockNumber);
    } catch (e: any) {
      console.error('Send failed:', e?.reason ?? e?.message ?? e);
    }
  }

    
  } else {
    console.log('[QUOTE] getDeliveryFee (DOT -> ETH)...');
    const fee = await toEthereumV2.getDeliveryFee(context, para, registry, tokenAddress);
    console.log('DeliveryFee:', fee);

    console.log('\n[CREATE] createTransfer (DOT -> ETH) - náhľad extrinsicu');
    const { tx } = await toEthereumV2.createTransfer(
      { sourceParaId: para, context }, registry, fromDot, toEth, tokenAddress, amount, fee
    );
    console.log('Substrate extrinsic vytvorený:', !!tx);
  }
  exit(0);
}

main().catch((e) => {
  console.error('❌ Chyba:', e);
  process.exit(1);
});
