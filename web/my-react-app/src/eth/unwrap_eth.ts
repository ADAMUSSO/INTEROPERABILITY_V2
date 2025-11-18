// src/eth/unwrap_eth.ts
import { ethers } from 'ethers';

const WETH_ADDRESS = import.meta.env.VITE_WETH_ADDRESS as `0x${string}`;
const WETH_ABI = [
  'function withdraw(uint256 wad)',
  'function balanceOf(address) view returns (uint256)',
];

export async function unwrapETH(amount: string, signer: ethers.Signer): Promise<string> {
  if (!WETH_ADDRESS) throw new Error('Missing WETH address in env');
  const weth = new ethers.Contract(WETH_ADDRESS, WETH_ABI, signer);

  const tx = await weth.withdraw(ethers.parseEther(amount));
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}
