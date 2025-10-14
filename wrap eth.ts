import { ethers } from 'ethers';
import 'dotenv/config';

const RPC = process.env.SEPOLIA_RPC!;
const PRIV = process.env.SEPOLIA_PRIVKEY!; // privátny kľúč účtu 0xC939...

const WETH = '0xfff9976782d46cc05630d1f6ebab18b2324d6b14';
const wethAbi = [
  'function deposit() payable',
  'function balanceOf(address) view returns (uint256)'
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PRIV, provider);
  const me = await wallet.getAddress();
  console.log('Signer:', me);

  const weth = new ethers.Contract(WETH, wethAbi, wallet);

  // zabaľ 0.01 ETH (môžeš zmeniť napr. na 0.003 alebo 0.005)
  const tx = await weth.deposit({ value: ethers.parseEther('0.01') });
  console.log('deposit tx:', tx.hash);
  await tx.wait();

  const bal = await weth.balanceOf(me);
  console.log('WETH balance:', bal.toString());
}

main().catch(console.error);
