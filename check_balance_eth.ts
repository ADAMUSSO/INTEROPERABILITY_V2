// ask-weth-balance.ts
import 'dotenv/config';
import { ethers } from 'ethers';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const NETWORK = (process.env.NETWORK || 'sepolia').toLowerCase();
const RPC = process.env.SEPOLIA_RPC || '';


const WETH_ADDRESS = (process.env.WETH_ADDRESS! ) as `0x${string}`;

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];




export async function askAndCheckWethBalance(): Promise<void> {
  if (!RPC) throw new Error('Chýba RPC_URL v .env');
  if (!WETH_ADDRESS) throw new Error(`Neznáma sieť "${NETWORK}". Nastav NETWORK=sepolia|mainnet alebo WETH_ADDRESS v .env.`);

  const rl = readline.createInterface({ input, output });
  try {
    const addr = (await rl.question('Zadaj Ethereum adresu: ')).trim();
    if (!ethers.isAddress(addr)) throw new Error('Neplatná adresa.');

    const provider = new ethers.JsonRpcProvider(RPC);
    // Rýchla kontrola RPC (pomáha odhaliť chybné endpointy)
    await provider.getBlockNumber();

    const token = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, provider);
    const [raw, decimals, symbol] = await Promise.all([
      token.balanceOf(addr),
      token.decimals().catch(() => 18),
      token.symbol().catch(() => 'WETH'),
    ]);

    console.log('\n--- Výsledok ---');
    console.log(`Sieť:        ${NETWORK}`);
    console.log(`WETH adresa: ${WETH_ADDRESS}`);
    console.log(`Účet:        ${addr}`);
    console.log(`Zostatok:    ${ethers.formatUnits(raw, decimals)} ${symbol}`);
    console.log(`(raw wei):   ${raw.toString()}`);
  } catch (err: any) {
    console.error('Chyba:', err?.message || err);
  } finally {
    rl.close();
  }
}


if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  askAndCheckWethBalance().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
