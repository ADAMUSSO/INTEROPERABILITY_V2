// src/snowbridge/transfers.ts
import { toPolkadotV2, toEthereumV2 } from '@snowbridge/api';
import type { Env } from './types';
import { makeContext } from './fees';
import { getAssetRegistry } from './registry';

// ---------- ETH -> DOT ----------
export async function previewEthToDot(
  env: Env,
  fromEth: string,
  toDotAddr: string,
  tokenAddress: string,
  paraId: number,
  amount: bigint
) {
  const context  = makeContext(env);
  const registry = getAssetRegistry(env);
  const fee = await toPolkadotV2.getDeliveryFee(context, registry, tokenAddress, paraId);
  const { tx } = await toPolkadotV2.createTransfer(
    registry, fromEth, toDotAddr, tokenAddress, paraId, amount, fee
  );
  return { fee, tx }; // tx: { to, data, value }
}

/** Odoslanie cez ethers.Signer (MetaMask/WalletConnect na webe, Wallet v CLI) */
export async function sendEthToDot(
  signer: import('ethers').Signer,
  txPreview: { to: string; data?: string; value?: bigint }
) {
  const send = await signer.sendTransaction({
    to: txPreview.to,
    data: txPreview.data,
    value: txPreview.value ?? 0n
  });
  return send.wait();
}

// ---------- DOT -> ETH ----------
export async function previewDotToEth(
  env: Env,
  fromDot: string,
  toEth: string,
  tokenAddress: string,
  paraId: number,
  amount: bigint
) {
  const context  = makeContext(env);
  const registry = getAssetRegistry(env);
  const fee = await toEthereumV2.getDeliveryFee(context, paraId, registry, tokenAddress);
  const { tx } = await toEthereumV2.createTransfer(
    { sourceParaId: paraId, context }, registry, fromDot, toEth, tokenAddress, amount, fee
  );
  return { fee, tx }; // tx: SubmittableExtrinsic
}

/** Odoslanie cez polkadot{js} signer (injektovaný extension alebo keyring v CLI) */
export async function sendDotToEth(
  tx: any, // SubmittableExtrinsic<'promise'>
  signer: any // Signer z polkadot{js}
) {
  return new Promise<void>((resolve, reject) => {
    let unsub: any;
    tx.signAndSend(signer, (result: any) => {
      const { status, dispatchError, events } = result;
      if (dispatchError) {
        if (unsub) unsub();
        reject(new Error(dispatchError.toString()));
        return;
      }
      if (status.isFinalized) {
        if (unsub) unsub();
        resolve();
      }
    }).then((u: any) => (unsub = u)).catch(reject);
  });
}
