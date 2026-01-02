// src/eth/wrap_eth.ts
import { ethers } from 'ethers';


const WETH_ADDRESS = '0xfff9976782d46cc05630d1f6ebab18b2324d6b14' as `0x${string}`;
const WETH_ABI = [
  'function deposit() payable',
  'function balanceOf(address) view returns (uint256)',
];

export async function wrapETH(amount: string, signer: ethers.Signer): Promise<string> {
  if (!WETH_ADDRESS) throw new Error('Missing WETH address in env');
  const weth = new ethers.Contract(WETH_ADDRESS, WETH_ABI, signer);

  const tx = await weth.deposit({ value: ethers.parseEther(amount) });
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}
