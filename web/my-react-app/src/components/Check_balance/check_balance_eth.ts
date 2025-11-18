// src/check_balance/check_balance_eth.ts
import { ethers } from 'ethers';

type EthChain = 'ethereum' | 'sepolia' | 'arbitrum' | 'optimism';

const RPCS: Record<EthChain, string> = {
  ethereum: import.meta.env.VITE_ETHEREUM_RPC!,
  sepolia: import.meta.env.VITE_SEPOLIA_RPC!,
  arbitrum: import.meta.env.VITE_ARBITRUM_RPC!,
  optimism: import.meta.env.VITE_OPTIMISM_RPC!,
};

const TOKENS: Record<EthChain, Record<string, string>> = {
  ethereum: {
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  sepolia: {
    WETH: import.meta.env.VITE_WETH_ADDRESS!,
  },
  arbitrum: {
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  },
  optimism: {
    USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
  },
};

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

export async function checkEthBalance(address: string, chain: EthChain, token: string): Promise<string> {
  const rpc = RPCS[chain];
  if (!rpc) throw new Error(`Missing RPC for ${chain}`);

  const provider = new ethers.JsonRpcProvider(rpc);

  if (token === 'ETH') {
    const balance = await provider.getBalance(address);
    return `${ethers.formatEther(balance)} ETH`;
  }

  const contractAddr = TOKENS[chain]?.[token];
  if (!contractAddr) throw new Error(`Token ${token} not supported on ${chain}`);

  const tokenContract = new ethers.Contract(contractAddr, ERC20_ABI, provider);
  const [raw, decimals, symbol] = await Promise.all([
    tokenContract.balanceOf(address),
    tokenContract.decimals().catch(() => 18),
    tokenContract.symbol().catch(() => token),
  ]);

  const human = ethers.formatUnits(raw, decimals);
  return `${human} ${symbol}`;
}
