// src/components/Transfer/executeTransfer.ts
import { Context, contextConfigFor, toPolkadotV2 } from '@snowbridge/api';
import { assetRegistryFor } from '@snowbridge/registry';
import { ethers } from 'ethers';

import { ApiPromise, WsProvider } from '@polkadot/api';
import { web3FromAddress } from '@polkadot/extension-dapp';

import type { PreparedTransfer } from './sharedTypes';
import { ASSET_HUB_PARA_ID, ASSET_HUB_PARASPELL_NAME, ASSET_HUB_WS } from './endpoints';

export type ProgressFn = (msg: string) => void;

async function getMetaMaskSigner(): Promise<ethers.Signer> {
  // @ts-ignore
  const { ethereum } = window;
  if (!ethereum) throw new Error('MetaMask is not available in the browser.');
  const provider = new ethers.BrowserProvider(ethereum);
  return provider.getSigner();
}

/** Snowbridge: EVM -> parachain */
async function sendSnowbridgeEvmToPara(
  prepared: PreparedTransfer,
  destParaId: number,
  progress?: ProgressFn,
) {
  const registry = assetRegistryFor(prepared.env as any);
  const context = new Context(contextConfigFor(prepared.env as any));

  progress?.('Snowbridge: calculating fee…');
  const fee = await toPolkadotV2.getDeliveryFee(context, registry, prepared.token.address, destParaId);

  progress?.('Snowbridge: preparing transfer…');
  const transfer = await toPolkadotV2.createTransfer(
    registry,
    prepared.sourceAddress, // EVM sender
    prepared.destAddress,   // Substrate recipient
    prepared.token.address, // ERC20 addr in registry
    destParaId,
    prepared.amountBase,
    fee,
  );

  progress?.('Snowbridge: validating transfer…');
  const validation = await toPolkadotV2.validateTransfer(context, transfer);
  if (!validation.success) {
    throw new Error(`Snowbridge failed to validate transfer: ${JSON.stringify(validation.logs)}`);
  }

  progress?.('Snowbridge: signing and sending EVM transaction (MetaMask)…');
  const signer = await getMetaMaskSigner();
  const resp = await signer.sendTransaction(transfer.tx);

  progress?.(`Snowbridge: tx sent: ${resp.hash} (waiting for confirmation...)`);
  const receipt = await resp.wait();

  if (!receipt) throw new Error(`EVM tx ${resp.hash} was not confirmed.`);
  progress?.(`Snowbridge: EVM tx confirmed ${resp.hash}`);
  return resp.hash;
}

/** ParaSpell: AssetHub -> destChain
 *  - signer/sender = prepared.sourceAddress (Talisman účet na AssetHube)
 *  - recipient     = prepared.destAddress
 */
async function sendParaspellFromAssetHub(
  prepared: PreparedTransfer,
  destChainName: string,
  progress?: ProgressFn,
) {
  progress?.('ParaSpell: connectign to AssetHub WS…');

  const ws = ASSET_HUB_WS[prepared.env];
  if (!ws) throw new Error('missing ASSET_HUB_WS endpoint v endpoints.ts.');
  if (ws.includes('YOUR_')) throw new Error('Set ASSET_HUB_WS endpoints in endpoints.ts');

  const provider = new WsProvider(ws);
  const api = await ApiPromise.create({ provider });

  try {
    // signer musí byť sourceAddress (kto posiela z AssetHubu)
    const injector = await web3FromAddress(prepared.sourceAddress);

    const { Builder } = await import('@paraspell/sdk-pjs');

    const fromChain = ASSET_HUB_PARASPELL_NAME[prepared.env];
    if (!fromChain) throw new Error('Missing ASSET_HUB_PARASPELL_NAME mapping in endpoints.ts');

    const amount = prepared.amountBase.toString();

    progress?.(`ParaSpell: preparing XCM ${fromChain} → ${destChainName}…`);
    const builder = Builder()
      .from(fromChain as any)
      .to(destChainName as any)
      .currency({ symbol: prepared.token.symbol, amount })
      .address(prepared.destAddress)          // recipient
      .senderAddress(prepared.sourceAddress); // sender (AssetHub účet)

    const tx: any = await builder.build();

    progress?.('ParaSpell: signing and sending extrinsic (Talisman)…');
    const hash: string = await new Promise((resolve, reject) => {
      tx.signAndSend(
        prepared.sourceAddress,
        { signer: injector.signer },
        (result: any) => {
          if (result?.dispatchError) {
            reject(new Error(result.dispatchError.toString()));
            return;
          }
          if (result?.status?.isInBlock || result?.status?.isFinalized) {
            resolve(tx.hash.toHex());
          }
        },
      ).catch(reject);
    });

    progress?.(`ParaSpell: tx in block ${hash}`);

    await builder.disconnect?.();
    return hash;
  } finally {
    await api.disconnect();
  }
}

export async function executeTransfer(
  prepared: PreparedTransfer,
  progress?: ProgressFn,
): Promise<{
  mode: 'snowbridge' | 'snowbridge+paraspell' | 'paraspell_only';
  evmTxHash?: string;
  substrateTxHash?: string;
}> {
  // 0) Substrate (AssetHub) -> ParaSpell (NOVÉ)
  if (prepared.source.kind !== 'evm' && prepared.dest.kind === 'paraspell') {
    progress?.(`Režim: ParaSpell (AssetHub → ${prepared.dest.label})`);
    const substrateTxHash = await sendParaspellFromAssetHub(prepared, prepared.dest.chainName, progress);
    progress?.('Hotovo ');
    return { mode: 'paraspell_only', substrateTxHash };
  }

  // 1) EVM -> parachain (Snowbridge)
  if (prepared.source.kind === 'evm' && prepared.dest.kind === 'snowbridge_para') {
    progress?.(`Režim: Snowbridge (1 fáza) → ${prepared.dest.label}`);
    const evmTxHash = await sendSnowbridgeEvmToPara(prepared, prepared.dest.parachainId, progress);
    progress?.('Hotovo ');
    return { mode: 'snowbridge', evmTxHash };
  }

  // 2) EVM -> AssetHub -> ParaSpell
  if (prepared.source.kind === 'evm' && prepared.dest.kind === 'paraspell') {
    progress?.(`Režim: 2-fázový (Snowbridge → ParaSpell) → ${prepared.dest.label}`);

    progress?.(`Fáza 1/2: Snowbridge → AssetHub (${ASSET_HUB_PARA_ID})…`);
    const evmTxHash = await sendSnowbridgeEvmToPara(prepared, ASSET_HUB_PARA_ID, progress);

    progress?.(`Fáza 2/2: ParaSpell → ${prepared.dest.chainName}…`);
    const substrateTxHash = await sendParaspellFromAssetHub(prepared, prepared.dest.chainName, progress);

    progress?.('Hotovo ');
    return { mode: 'snowbridge+paraspell', evmTxHash, substrateTxHash };
  }

  throw new Error(
    `Unsupported combination: source=${prepared.source.kind}, dest=${prepared.dest.kind}`,
  );
}
