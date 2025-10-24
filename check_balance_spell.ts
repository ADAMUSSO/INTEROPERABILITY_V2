import { getAssetBalance,getAssetDecimals } from "@paraspell/sdk";
import 'dotenv/config';
import WebSocket from 'ws';
// polkadot-api hľadá globalThis.WebSocket
// urob to ešte pred volaním @paraspell/sdk
// @ts-ignore
(globalThis as any).WebSocket = WebSocket;

const ADDRESS = process.env.PASEO_ADDRESS!;
  

async function main() {
  const balance = await getAssetBalance({
    address: ADDRESS,
    chain: 'AssetHubPaseo',
    currency: { symbol: "WETH" }, // alebo { symbol: Native("PAS") }, prípadne { id: 0 } alebo { location: "..." }                       // voliteľné (môže byť aj pole RPC URL)
  });

  console.log("Raw balance (base units):", balance);

  const decimals = await getAssetDecimals("AssetHubPaseo", "WETH");
  if (decimals == null) throw new Error("Nepodarilo sa získať desatinné miesta.");

  // --- spôsob 1: klasický prepočet ---
  const human = Number(balance) / 10 ** decimals;
  console.log(`≈ ${human} PAS`);

  // --- spôsob 2: formátovaný výpis s fixnou presnosťou ---
  console.log(`≈ ${(Number(balance) / 10 ** decimals).toFixed(6)} PAS`);
  process.exit(0);

}

main().catch(console.error);