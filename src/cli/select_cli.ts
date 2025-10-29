// src/cli/select_cli.ts
import prompts from 'prompts';
import 'dotenv/config';
import { ethers } from 'ethers';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

import { Env, Direction, TokenInfo, envLabel } from '../snowbridge/types';
import { isHexAddress, isSs58, toBaseUnits } from '../snowbridge/utils';
import { readRegistryJson, getAssetRegistry, listParachainChoices } from '../snowbridge/registry';
import { tokensFromRegistryJson, tokensFromRegistryObject } from '../snowbridge/tokens';
import { filterSupportedForRoute } from '../snowbridge/fees';
import { previewEthToDot, sendEthToDot, previewDotToEth, sendDotToEth } from '../snowbridge/transfers';

/** Len pre CLI – použije .env privkey; vo webe to nerob! */
function getSepoliaWallet() {
  const rpc = process.env.SEPOLIA_RPC;
  const pk  = process.env.SEPOLIA_PRIVKEY;
  if (!rpc || !pk) throw new Error('Chýba SEPOLIA_RPC alebo SEPOLIA_PRIVKEY v .env');
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  return { provider, wallet };
}

async function main() {
  // 1) env
  const envAns = await prompts({
    type: 'select', name: 'env', message: 'Vyber environment', initial: 1,
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
    type: 'select', name: 'direction', message: 'Smer prenosu',
    choices: [
      { title: `${evm} ➜ ${dot} (ETH → DOT)`, value: 'eth_to_dot' },
      { title: `${dot} ➜ ${evm} (DOT → ETH)`, value: 'dot_to_eth' }
    ]
  });
  const direction = dirAns.direction as Direction;

  // 3) parachain výber z registry
  const choices = listParachainChoices(env);
  const paraChoice = await prompts({
    type: 'select', name: 'paraPreset',
    message: direction === 'eth_to_dot' ? 'Cieľový parachain (paraId)' : 'Zdrojový parachain (paraId)',
    choices: [...choices, { title: 'Zadať vlastné paraId…', value: -1 }]
  });

  let paraId: number = paraChoice.paraPreset;
  if (paraId === -1) {
    const manual = await prompts({
      type: 'text', name: 'pid', message: 'Zadaj paraId (napr. 1000):',
      validate: (v: string) => /^\d+$/.test(v) ? true : 'Zadaj celé číslo'
    });
    paraId = Number(manual.pid);
  }

  // 4) tokeny
  const regJson = readRegistryJson(env);
  const regObj  = getAssetRegistry(env);
  let candidates: TokenInfo[] = (regJson ? tokensFromRegistryJson(regJson, direction, paraId) : []);
  if (candidates.length === 0) candidates = tokensFromRegistryObject(regObj);

  console.log(`[Registry] Nájdených tokenov pre ${env}: ${candidates.length}`);
  candidates = await filterSupportedForRoute(env, direction, paraId, candidates);
  console.log(`[Registry] Použiteľných pre danú trasu: ${candidates.length}`);

  let chosen: TokenInfo | null = null;
  if (candidates.length > 0) {
    const pick = await prompts({
      type: 'select', name: 'sel', message: 'Vyber token',
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
        { type: 'text', name: 'addr', message: `Zadaj ERC-20 kontrakt (0x...):`, validate: (v: string) => isHexAddress(v) ? true : 'Neplatná adresa' },
        { type: 'number', name: 'dec',  message: 'Decimals (0–36):', validate: (v: number) => Number.isInteger(v) && v >= 0 && v <= 36 ? true : '0–36' }
      ]);
      chosen = { symbol: 'CUSTOM', address: (ans.addr as string).toLowerCase(), decimals: Number(ans.dec) };
    } else {
      chosen = JSON.parse(pick.sel as string) as TokenInfo;
      chosen.address = chosen.address.toLowerCase();
      if (typeof chosen.decimals !== 'number') {
        const ans = await prompts([{ type: 'number', name: 'dec', message: `Zadaj decimals pre ${chosen.symbol}:`, validate: (v: number) => Number.isInteger(v) && v >= 0 && v <= 36 ? true : '0–36' }]);
        chosen.decimals = Number(ans.dec);
      }
    }
  } else {
    const ans = await prompts([
      { type: 'text', name: 'addr', message: `Token na ${evm} – zadaj ERC-20 kontrakt (0x...):`, validate: (v: string) => isHexAddress(v) ? true : 'Neplatná adresa' },
      { type: 'number', name: 'dec',  message: 'Decimals (0–36):', validate: (v: number) => Number.isInteger(v) && v >= 0 && v <= 36 ? true : '0–36' }
    ]);
    chosen = { symbol: 'CUSTOM', address: (ans.addr as string).toLowerCase(), decimals: Number(ans.dec) };
  }

  const tokenAddress = chosen!.address;
  const tokenDecimals = chosen!.decimals as number;
  const chosenSymbol = chosen!.symbol;

  // 5) amount
  let amount: bigint | null = null;
  while (amount === null) {
    const a = await prompts({ type: 'text', name: 'val', message: `Množstvo (${chosenSymbol}) (napr. 1.5):` });
    try { amount = toBaseUnits(String(a.val), tokenDecimals); } catch (e: any) { console.log('⚠️ ', e?.message ?? 'Neplatná hodnota.'); amount = null; }
  }

  // 6) adresy
  let fromEth = '', toEth = '', fromDot = '', toDotAddr = '';
  if (direction === 'eth_to_dot') {
    const a = await prompts([
      { type: 'text', name: 'fromEth', message: `Tvoja EVM adresa na ${evm} (0x...):`, validate: (v: string) => isHexAddress(v) ? true : 'Neplatná' },
      { type: 'text', name: 'toDot',  message: `Cieľová ${dot} adresa (SS58):`,      validate: (v: string) => isSs58(v) ? true : 'Neplatná' }
    ]);
    fromEth = (a.fromEth as string).toLowerCase();
    toDotAddr = a.toDot as string;
  } else {
    const a = await prompts([
      { type: 'text', name: 'fromDot', message: `Tvoja ${dot} adresa (SS58):`, validate: (v: string) => isSs58(v) ? true : 'Neplatná' },
      { type: 'text', name: 'toEth',   message: `Cieľová EVM adresa (0x...):`, validate: (v: string) => isHexAddress(v) ? true : 'Neplatná' }
    ]);
    fromDot = a.fromDot as string;
    toEth = (a.toEth as string).toLowerCase();
  }

  console.log('\n================ VÝBER =================');
  console.log('ENV:        ', env);
  console.log('Smer:       ', direction);
  console.log('Parachain:  ', paraId);
  console.log('Token:      ', `${chosenSymbol} @ ${tokenAddress} (dec ${tokenDecimals})`);
  console.log('Amount:     ', amount.toString());
  console.log('========================================\n');

  if (direction === 'eth_to_dot') {
    const { fee, tx } = await previewEthToDot(env, fromEth, toDotAddr, tokenAddress, paraId, amount);
    console.log('DeliveryFee:', fee);
    console.log('EVM tx preview:', { to: (tx as any)?.to, value: (tx as any)?.value?.toString?.(), dataLen: (tx as any)?.data?.length });

    const exec = await prompts({ type: 'confirm', name: 'go', message: 'Poslať transakciu teraz?', initial: false });
    if (exec.go) {
      const { wallet } = getSepoliaWallet(); // CLI-only
      const receipt = await sendEthToDot(wallet, tx as any);
      console.log('✅ Sent, block:', receipt?.blockNumber);
    }
  } else {
    const { fee, tx } = await previewDotToEth(env, fromDot, toEth, tokenAddress, paraId, amount);
    console.log('DeliveryFee:', fee);
    console.log('Extrinsic ready:', !!tx);

    const exec = await prompts({ type: 'confirm', name: 'go', message: 'Odoslať extrinsic?', initial: false });
    if (exec.go) {
      await cryptoWaitReady();
      const keyring = new Keyring({ type: 'sr25519' });
      const seedOrMnemonic = process.env.PASEO_SEED ?? process.env.PASEO_MNEMONIC ?? null;
      if (!seedOrMnemonic) throw new Error('Chýba PASEO_SEED alebo PASEO_MNEMONIC v .env');
      const signer = keyring.addFromUri(seedOrMnemonic);
      await sendDotToEth(tx, signer);
      console.log('✅ Finalized.');
    }
  }
}

main().catch(e => { console.error('❌ Chyba:', e); process.exit(1); });
