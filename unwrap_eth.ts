import { ethers } from 'ethers';
import 'dotenv/config';

const RPC = process.env.SEPOLIA_RPC!;
const PRIV = process.env.SEPOLIA_PRIVKEY!;

const WETH = '0xfff9976782d46cc05630d1f6ebab18b2324d6b14';
const wethAbi = [
  'function deposit() payable',
  'function withdraw(uint256 wad)',
  'function balanceOf(address) view returns (uint256)'
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PRIV, provider);
  const me = await wallet.getAddress();

  const weth = new ethers.Contract(WETH, wethAbi, wallet);

  const amount = ethers.parseEther('0.0129'); // koľko WETH chceš rozbaliť
  const bal = await weth.balanceOf(me);
  if (bal < amount) {
    throw new Error(`Nedostatok WETH: máš ${ethers.formatEther(bal)}, chceš ${ethers.formatEther(amount)}`);
  }

  const tx = await weth.withdraw(amount);
  console.log('withdraw tx:', tx.hash);
  const rcpt = await tx.wait();
  console.log('✅ Finalized in block:', rcpt?.blockNumber);

  const newBal = await weth.balanceOf(me);
  console.log('WETH balance (after):', ethers.formatEther(newBal));
}

main().catch(console.error);
