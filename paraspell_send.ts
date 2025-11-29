// 0) Polyfill WebSocket pre Node
import { WebSocket } from 'ws';
(globalThis as any).WebSocket = WebSocket;

import { Builder, getAssetDecimals, getAllAssetsSymbols, CHAINS, type TChain } from '@paraspell/sdk';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { getPolkadotSigner } from 'polkadot-api/signer';
import 'dotenv/config';
import prompts from 'prompts';

// CHAINS je už pole stringov – použijeme ho priamo
const ALL_CHAINS = [...CHAINS] as TChain[];


const FROM  = process.env.PASEO_ADDRESS!;
const TO    = process.env.PASEO_ADDRESS_2!;
const MNEMO = process.env.PASEO_MNEMONIC!;

// Prevedieme CHAINS objekt na pole stringov


function toBaseUnits(human: string, decimals: number): bigint {
  const s = human.trim().replace(/_/g, '').replace(/,/g, '');
  if (!/^(\d+)(\.\d+)?$/.test(s)) throw new Error('Neplatné číslo.');
  const [intPart, fracRaw = ''] = s.split('.');
  if (fracRaw.length > decimals) throw new Error(`Príliš veľa desatinných miest (max ${decimals}).`);
  const frac = fracRaw.padEnd(decimals, '0');
  const full = intPart + frac;
  const normalized = full.replace(/^0+(?=\d)/, '');
  return normalized === '' ? 0n : BigInt(normalized);
}

async function main() {
  await cryptoWaitReady();

  const pair = new Keyring({ type: 'sr25519' }).addFromUri(MNEMO);
  const signer = getPolkadotSigner(pair.publicKey, 'Sr25519', (payload) => pair.sign(payload));

  // --- Výber chainov priamo z Paraspell SDK ---
  const chainAns = await prompts(
    [
    {
      type: 'select',
      name: 'fromChain',
      message: 'Z ktorého chainu chceš posielať?',
      choices: ALL_CHAINS.map((c) => ({ title: c, value: c })),
      initial: 0,
    },
    {
      type: 'select',
      name: 'toChain',
      message: 'Na ktorý chain chceš posielať?',
      choices: ALL_CHAINS.map((c) => ({ title: c, value: c })),
      initial: 0,
    }
  ],
  { onCancel: () => process.exit(1) }
);

const fromChain = chainAns.fromChain as TChain;
const toChain   = chainAns.toChain   as TChain;

  console.log(`\nDostupné meny na chain-e ${fromChain}:`);
  try {
    const symbols = await getAllAssetsSymbols(fromChain as any);
    console.log(symbols.join(', '));
  } catch (e) {
    console.error('Nepodarilo sa načítať symboly:', e);
  }

  // --- Inputs ---
  const resp = await prompts(
    [
      { type: 'text', name: 'from', message: 'Adresa odosielateľa:', initial: FROM },
      { type: 'text', name: 'to',   message: 'Adresa prijímateľa:', initial: TO },
      {
        type: 'text',
        name: 'currency',
        message: `Mena (symbol) na chain-e ${fromChain}:`,
        initial: 'PAS'
      },
      {
        type: 'text',
        name: 'amount',
        message: 'Koľko chceš poslať:',
        initial: '0.0001',
        validate: (v) => /^(\d+)(\.\d+)?$/.test(String(v)) ? true : 'Neplatné číslo'
      }
    ],
    { onCancel: () => process.exit(1) }
  );

  const { from, to, currency, amount } = resp;

  const decimals = await getAssetDecimals(fromChain as any, currency);
  if (decimals == null) throw new Error(`Nenašiel som decimals pre ${currency} na ${fromChain}.`);

  const baseAmount = toBaseUnits(amount, decimals);

  console.log('\n--- Nastavenia transakcie ---');
  console.log('FROM chain:', fromChain);
  console.log('TO chain:  ', toChain);
  console.log('Token:', currency, `(decimals=${decimals})`);
  console.log('Suma:', amount, '→', baseAmount.toString(), '\n');

  // --- Paraspell Builder ---
  const builder = Builder({})
    .from(fromChain as any)
    .to(toChain as any)
    .currency({ symbol: currency, amount: baseAmount })
    .address(to)
    .senderAddress(from);

  const tx = await builder.build();
  const finalized = await (tx as any).signAndSubmit(signer);

  console.log('✅ Hotovo!');
  console.log('TX hash:', finalized.txHash);
  console.log('Block:', finalized.block.number);

  await builder.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
