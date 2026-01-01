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
  if (!ethereum) throw new Error('MetaMask nie je dostupná.');
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

  progress?.('Snowbridge: počítam delivery fee…');
  const fee = await toPolkadotV2.getDeliveryFee(
    context,
    registry,
    prepared.token.address,
    destParaId,
  );

  progress?.('Snowbridge: pripravujem transfer…');
  const transfer = await toPolkadotV2.createTransfer(
    registry,
    prepared.sourceAddress, // EVM sender
    prepared.destAddress,   // Substrate recipient
    prepared.token.address, // ERC20 addr in registry
    destParaId,
    prepared.amountBase,
    fee,
  );

  progress?.('Snowbridge: validujem transfer…');
  const validation = await toPolkadotV2.validateTransfer(context, transfer);
  if (!validation.success) {
    throw new Error(`Snowbridge validateTransfer failed: ${JSON.stringify(validation.logs)}`);
  }

  progress?.('Snowbridge: podpisujem a posielam EVM transakciu (MetaMask)…');
  const signer = await getMetaMaskSigner();
  const resp = await signer.sendTransaction(transfer.tx);

  progress?.(`Snowbridge: tx odoslaná: ${resp.hash} (čakám na potvrdenie…)`);
  const receipt = await resp.wait();

  if (!receipt) throw new Error(`EVM tx ${resp.hash} nebola potvrdená.`);
  progress?.(`Snowbridge: EVM tx potvrdená ✅ ${resp.hash}`);

  return resp.hash;
}

/** ParaSpell: AssetHub -> destChain */
async function sendParaspellFromAssetHub(
  prepared: PreparedTransfer,
  destChainName: string,
  progress?: ProgressFn,
) {
  progress?.('ParaSpell: pripájam sa na AssetHub WS…');

  const ws = ASSET_HUB_WS[prepared.env];
  if (!ws) throw new Error('Chýba AssetHub WS endpoint (ASSET_HUB_WS) pre toto env.');
  if (ws.includes('YOUR_')) throw new Error('Nastav ASSET_HUB_WS endpointy v endpoints.ts');

  const provider = new WsProvider(ws);
  const api = await ApiPromise.create({ provider });

  const injector = await web3FromAddress(prepared.destAddress);

  const { Builder } = await import('@paraspell/sdk-pjs');

  const fromChain = ASSET_HUB_PARASPELL_NAME[prepared.env];
  if (!fromChain) throw new Error('Chýba ASSET_HUB_PARASPELL_NAME mapping v endpoints.ts');

  // ParaSpell chce amount ako string (base units)
  const amount = prepared.amountBase.toString();

  progress?.(`ParaSpell: pripravujem XCM ${fromChain} → ${destChainName}…`);
  const builder = Builder()
    .from(fromChain as any)
    .to(destChainName as any)
    .currency({ symbol: prepared.token.symbol, amount })
    .address(prepared.destAddress)        // recipient (zatiaľ posielame sebe)
    .senderAddress(prepared.destAddress); // sender (tvoj účet na AssetHube)

  const tx: any = await builder.build();

  progress?.('ParaSpell: podpisujem a posielam extrinsic (Talisman)…');
  const hash: string = await new Promise((resolve, reject) => {
    tx.signAndSend(
      prepared.destAddress,
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

  progress?.(`ParaSpell: tx v bloku ✅ ${hash}`);

  await api.disconnect();
  await builder.disconnect?.();

  return hash;
}

export async function executeTransfer(
  prepared: PreparedTransfer,
  progress?: ProgressFn,
): Promise<{
  mode: 'snowbridge' | 'snowbridge+paraspell';
  evmTxHash: string;
  substrateTxHash?: string;
}> {
  if (prepared.source.kind !== 'evm') {
    throw new Error('Source musí byť EVM.');
  }

  // 1-fázový: Snowbridge priamo na parachain
  if (prepared.dest.kind === 'snowbridge_para') {
    progress?.(`Režim: Snowbridge (1 fáza) → ${prepared.dest.label}`);
    const evmTxHash = await sendSnowbridgeEvmToPara(
      prepared,
      prepared.dest.parachainId,
      progress,
    );
    progress?.('Hotovo ✅');
    return { mode: 'snowbridge', evmTxHash };
  }

  // 2-fázový: Snowbridge → AssetHub → ParaSpell
  if (prepared.dest.kind === 'paraspell') {
    progress?.(`Režim: 2-fázový (Snowbridge → ParaSpell) → ${prepared.dest.label}`);

    progress?.(`Fáza 1/2: Snowbridge → AssetHub (${ASSET_HUB_PARA_ID})…`);
    const evmTxHash = await sendSnowbridgeEvmToPara(
      prepared,
      ASSET_HUB_PARA_ID,
      progress,
    );

    // Poznámka: tu by ideálne malo byť čakanie na doraz assetu / balance polling.
    // Zatiaľ spúšťame fázu 2 hneď (môže zlyhať ak asset ešte nedorazil).
    progress?.(`Fáza 2/2: ParaSpell → ${prepared.dest.chainName}…`);
    const substrateTxHash = await sendParaspellFromAssetHub(
      prepared,
      prepared.dest.chainName,
      progress,
    );

    progress?.('Hotovo ✅');
    return { mode: 'snowbridge+paraspell', evmTxHash, substrateTxHash };
  }

  throw new Error('Neznámy destination typ.');
}
