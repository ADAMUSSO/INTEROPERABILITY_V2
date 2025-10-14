// scan_assets_balance.ts
import { ApiPromise, WsProvider } from '@polkadot/api';

const WHO = '12jgjA8uUHV2jypBey9Viv13A9J8QuvmM19GvmQg1dNWmGPp';
const WS  = 'wss://asset-hub-paseo-rpc.dwellir.com';

async function main() {
  const api = await ApiPromise.create({ provider: new WsProvider(WS) });

  console.log('Chain:', (await api.rpc.system.chain()).toHuman?.() ?? '');
  console.log('Spec :', (await api.rpc.state.getRuntimeVersion()).specName.toString(),
                        (await api.rpc.state.getRuntimeVersion()).specVersion.toString());

  // 1) prečítaj všetky metadata pre pallet `assets`
  const entries = await api.query.assets.metadata.entries();

  console.log(`Found metadata entries: ${entries.length}`);

  // 2) pre každý assetId skús account(WHO). Ak balance > 0, vypíš.
  let hits = 0;
  for (const [storageKey, meta] of entries) {
    const assetId = storageKey.args[0].toString();
    const humanMeta: any = meta.toHuman();
    const symbol = humanMeta?.symbol ?? humanMeta?.Symbol ?? '';
    const name   = humanMeta?.name ?? humanMeta?.Name ?? '';

    const acc = await api.query.assets.account(assetId as any, WHO);
    if (acc.isSome) {
      const unwrap: any = acc.unwrap();
      const bal = unwrap.balance?.toString?.() ?? '0';
      if (bal !== '0') {
        hits++;
        console.log(`>> assetId=${assetId} symbol=${symbol} name=${name} balance=${bal}`);
      }
    }
  }

  if (hits === 0) {
    console.log('Žiadny nenulový zostatok v pallet `assets` pre tento účet.');
    console.log('Skúsime ešte foreignAssets…');
    // 3) doplnkové: skús foreignAssets.account cez StagingXcmV4Location (parents 0/1)
    const chainId = 11155111;
    const erc20   = '0xfff9976782d46cc05630d1f6ebab18b2324d6b14';

    for (const parents of [0, 1]) {
      try {
        const loc = api.registry.createType('StagingXcmV4Location', {
          parents,
          interior: {
            X2: [
              { GlobalConsensus: { Ethereum: { chainId } } },
              { AccountKey20: { key: erc20 } }
            ]
          }
        } as any);
        // account vs assetAccount – skúsi oboje, ktoré existuje
        const q: any = api.query.foreignAssets;
        for (const store of ['account', 'assetAccount']) {
          if (!q?.[store]) continue;
          const res = await q[store](loc as any, WHO);
          console.log(`[foreignAssets.${store}] parents=${parents} ->`,
            res?.isSome ? res.toHuman() : 'None');
        }
      } catch (e: any) {
        console.log(`[foreignAssets] parents=${parents} error:`, e?.message ?? e);
      }
    }
  }

  await api.disconnect();
}

main().catch(console.error);
