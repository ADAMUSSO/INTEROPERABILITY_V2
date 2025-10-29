// 0) Polyfill WebSocket pre Node (nutné aj pri auto-endpointoch)
import { WebSocket } from 'ws';
(globalThis as any).WebSocket = WebSocket;

import { Builder, getAssetDecimals, getAllAssetsSymbols,formatUnits } from '@paraspell/sdk';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { getPolkadotSigner } from 'polkadot-api/signer';
import 'dotenv/config';
import prompts from 'prompts';

const FROM  = process.env.PASEO_ADDRESS!;   // odosielateľ
const TO    = process.env.PASEO_ADDRESS_2!; // príjemca
const MNEMO = process.env.PASEO_MNEMONIC!;  // 12/24 slov

// Bezpečná konverzia "1.2345" -> base units BigInt podľa decimals
function toBaseUnits(human: string, decimals: number): bigint {
  const s = human.trim().replace(/_/g, '').replace(/,/g, '');
  if (!/^(\d+)(\.\d+)?$/.test(s)) throw new Error('Neplatné číslo.');
  const [intPart, fracRaw = ''] = s.split('.');
  if (fracRaw.length > decimals) {
    // orezanie by menilo hodnotu – radšej failni
    throw new Error(`Príliš veľa desatinných miest (max ${decimals}).`);
  }
  const frac = fracRaw.padEnd(decimals, '0');
  const full = intPart + frac;
  return BigInt(full.replace(/^0+(?=\d)/, '')) || 0n;
}

async function main() {
  await cryptoWaitReady();

  // 1) sr25519 pár + PAPI signer
  const pair = new Keyring({ type: 'sr25519' }).addFromUri(MNEMO);
  const signer = getPolkadotSigner(pair.publicKey, 'Sr25519', (payload) => pair.sign(payload));

  console.log('Dostupné meny na AssetHubPaseo:', await getAllAssetsSymbols('AssetHubPaseo'));

  const resp = await prompts([
    { type: 'text', name: 'from',     message: 'Adresa odosielateľa:', initial: FROM },
    { type: 'text', name: 'to',       message: 'Adresa prijímateľa:', initial: TO },
    { type: 'text', name: 'currency', message: 'Mena (symbol):',      initial: 'PAS' },
    {
      type: 'text',
      name: 'amount',
      message: 'Koľko chceš poslať (ľudské jednotky):',
      initial: '0.0001',
      validate: (v) => (/^(\d+)(\.\d+)?$/.test(String(v)) ? true : 'Zadaj nezáporné číslo')
    }
  ], { onCancel: () => { console.log('Zrušené.'); process.exit(1); } });

  const { from, to, currency, amount } = resp as { from: string; to: string; currency: string; amount: string; };

  const decimals = await getAssetDecimals('AssetHubPaseo', currency);
  if (decimals == null) throw new Error(`Neviem zistiť decimals pre ${currency} na AssetHubPaseo.`);
  const baseAmount = toBaseUnits(amount, decimals);

  console.log('\n--- Nastavenia transakcie ---');
  console.log('Odosielateľ:', from);
  console.log('Príjemca:', to);
  console.log('Mena:', currency, `(decimals=${decimals})`);
  console.log('Suma:', amount);
  console.log('Suma (base units):', baseAmount.toString());
  console.log('-----------------------------\n');

  // 2) Builder bez WS (Paraspell zvolí default RPC)
  const builder = Builder({})
    .from('AssetHubPaseo')
    .to('AssetHubPaseo')
    .currency({ symbol: currency, amount: baseAmount })
    .address(to)
    .senderAddress(from); // odporúčané kvôli ED/auto-swapu na DOT, ak treba

  // 3) build → sign & submit
  const tx = await builder.build();
  const finalized = await (tx as any).signAndSubmit(signer);

  console.log('✅ Transakcia finalizovaná');
  console.log('TX hash:', finalized.txHash);
  console.log('Blok číslo:', finalized.block.number);
  console.log('Blok hash:', finalized.block.hash);
  
  await builder.disconnect();

  process.exit(0);
}

main()
