// Polyfill ostáva:
import { WebSocket } from 'ws';
(globalThis as any).WebSocket = WebSocket;

import { Builder, getAssetDecimals } from '@paraspell/sdk';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { getPolkadotSigner } from 'polkadot-api/signer';
import 'dotenv/config';

const FROM = process.env.PASEO_ADDRESS!;
const TO   = process.env.PASEO_ADDRESS_2!;
const MNEMO= process.env.PASEO_MNEMONIC!;

async function main() {
  await cryptoWaitReady();

  const pair = new Keyring({ type: 'sr25519' }).addFromUri(MNEMO);
  const signer = getPolkadotSigner(pair.publicKey, 'Sr25519', (p) => pair.sign(p));

  const currency = 'PAS';
  const humanAmount = '0.1'; // ľudské jednotky

  // Builder bez WS + abstrahované desatinné miesta
  const builder = await Builder({
    abstractDecimals: true, // <<< kľúčové
  })
    .from('AssetHubPaseo')
    .to('AssetHubPaseo')
    .currency({ symbol: currency, amount: humanAmount }) // dáš ľudské
    .address(TO)
    .senderAddress(FROM);

  const tx = await builder.build();
  const finalized = await (tx as any).signAndSubmit(signer);

  console.log('TX hash:', finalized.txHash);
  await (builder as any).disconnect?.();
}
main().catch(console.error);
