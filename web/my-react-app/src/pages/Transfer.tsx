import { useEffect, useState } from 'react';
import './Transfer.css';

//==============SNOWBRIDGE IMPORTY=================


import EnvToggle from '../components/Transfer/EnvToggle';
import WalletModal from '../components/Transfer/WalletModal';

import SourceChainInput from '../components/Transfer/SourceChainInput';
import DestChainInput from '../components/Transfer/DestChainInput';
import AmountAndTokenRow from '../components/Transfer/AmountAndTokenRow';
import SourceAddressRow from '../components/Transfer/SourceAddressRow';
import DestinationAddressRow from '../components/Transfer/DestinationAddressRow';
import SwapButton from '../components/Transfer/SwapButton';
import SubmitButton from '../components/Transfer/SubmitButton';
import TransferError from '../components/Transfer/TransferError';

import type { Env, WalletKind } from '../components/Transfer/types';


// ---- Paraspell helper: dostupné chainy z @paraspell/sdk ----
async function getParaspellChainsForEnv(env: Env): Promise<string[]> {
  try {
    const sdk = await import('@paraspell/sdk');
    const CHAINS: string[] = (sdk as any).CHAINS ?? [];

    // ALL_CHAINS = [...CHAINS] ako v tvojom CLI
    const allChains = [...CHAINS];

    // jednoduchý filter podľa prostredia
    switch (env) {
      case 'paseo_sepolia':
        // Paseo testnet chainy – prispôsob si podľa reálnych názvov
        return allChains.filter((c) => c.toLowerCase().includes('paseo'));

      case 'westend_sepolia':
        return allChains.filter((c) => c.toLowerCase().includes('westend'));

      case 'polkadot_mainnet':
        // mainnet: všetko ostatné, čo nie je Paseo/Westend
        return allChains.filter(
          (c) =>
            !c.toLowerCase().includes('paseo') &&
            !c.toLowerCase().includes('westend'),
        );

      default:
        return [];
    }
  } catch (e) {
    console.error('[Transfer] Failed to load Paraspell CHAINS:', e);
    return [];
  }
}

//================= CONVERT  DECIMALS TO BASEUNITS=================
function toBaseUnits(amountStr: string, decimals: number): bigint {
  let s = amountStr.trim();

  if (!s) {
    throw new Error('Amount is empty');
  }

  // voliteľne: podpor aj čiarku ako desatinnú
  s = s.replace(',', '.');

  // povolíme formáty: "123", "1.58", "0.003", ".5"
  if (!/^\d*\.?\d+$/.test(s)) {
    throw new Error('Invalid amount format');
  }

  // ak je typu ".5", spravíme z toho "0.5"
  if (s.startsWith('.')) {
    s = '0' + s;
  }

  const [intPartRaw, fracPartRaw = ''] = s.split('.');
  const intPart = intPartRaw || '0';

  if (fracPartRaw.length > decimals) {
    throw new Error(`Too many decimal places (max ${decimals})`);
  }

  const fracPart = fracPartRaw.padEnd(decimals, '0'); // doplníme nuly doprava
  const fullStr = intPart + fracPart;                 // "1.58" + 6 dec → "1580000"

  // odstráň leading zeros, ale nechaj aspoň jednu nulu
  const normalized = fullStr.replace(/^0+/, '') || '0';

  return BigInt(normalized);
}









/* ===================== Registry helpers ===================== */

export type TokenInfo = {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  origin: 'evm' | 'parachain';
  parachainId?: number;
};

function evmLabelForEnv(env: Env): string {
  switch (env) {
    case 'paseo_sepolia':
      return 'Sepolia';
    case 'westend_sepolia':
      return 'Sepolia';
    case 'polkadot_mainnet':
      return 'Ethereum';
    default:
      return 'EVM';
  }
}

function extractParaName(meta: any): string | undefined {
  return (
    meta?.name ||
    meta?.display ||
    meta?.chainName ||
    meta?.parachainName ||
    meta?.metadata?.name ||
    meta?.info?.name ||
    meta?.id ||
    undefined
  );
}

const FALLBACK_PARA_NAMES: Partial<Record<Env, Record<number, string>>> = {
  paseo_sepolia: {
    1000: 'AssetHub (Paseo)',
  },
  westend_sepolia: {
    1000: 'AssetHub (Westend)',
  },
  polkadot_mainnet: {
    1000: 'AssetHub',
  },
};


const HUB_LABEL_BY_ENV: Partial<Record<Env, string>> = {
  paseo_sepolia: 'Paseo AssetHub (1000)',
  westend_sepolia: 'Westend AssetHub (1000)',
  polkadot_mainnet: 'Polkadot AssetHub (1000)',
};


function labelForPara(env: Env, pid: number, meta: any): string {
  const fromMeta = extractParaName(meta);
  const fromFallback = FALLBACK_PARA_NAMES[env]?.[pid];
  const name = fromMeta || fromFallback || 'Parachain';
  return `${name} (${pid})`;
}

async function loadRegistryJson(env: Env): Promise<any | null> {
  try {
    if (env === 'paseo_sepolia') {
      const mod = await import('@snowbridge/registry/dist/paseo_sepolia.registry.json');
      return (mod as any).default ?? mod;
    }
    if (env === 'westend_sepolia') {
      const mod = await import('@snowbridge/registry/dist/westend_sepolia.registry.json');
      return (mod as any).default ?? mod;
    }
    if (env === 'polkadot_mainnet') {
      const mod = await import('@snowbridge/registry/dist/polkadot_mainnet.registry.json');
      return (mod as any).default ?? mod;
    }
    return null;
  } catch (e) {
    console.error('[Transfer] Failed to load registry JSON for env=', env, e);
    return null;
  }
}


function extractTokensFromRegistryJson(reg: any): TokenInfo[] {
  if (!reg) return [];

  const tokens: TokenInfo[] = [];

  const ethChains = reg.ethereumChains ?? {};
  for (const chainKey of Object.keys(ethChains)) {
    const chain = ethChains[chainKey];
    const assets = chain.assets ?? {};

    for (const [address, meta] of Object.entries<any>(assets)) {
      tokens.push({
        chainId: chain.chainId,
        address,
        name: meta.name ?? '',
        symbol: meta.symbol ?? '',
        decimals: meta.decimals ?? 0,
        origin: 'evm',
      });
    }
  }

  const parachains = reg.parachains ?? {};
  for (const paraKey of Object.keys(parachains)) {
    const para = parachains[paraKey];
    const assets = para.assets ?? {};

    for (const [address, meta] of Object.entries<any>(assets)) {
      tokens.push({
        chainId: para.parachainId,
        address,
        name: meta.name ?? '',
        symbol: meta.symbol ?? '',
        decimals: meta.decimals ?? 0,
        origin: 'parachain',
        parachainId: para.parachainId,
      });
    }
  }

  return tokens;
}




async function fetchChainsForEnv(
  env: Env,
): Promise<{ sourceChains: string[]; destChains: string[]; tokens: TokenInfo[] }> {
  // 1) SNOWBRIDGE – EVM label + parachainy z registry JSON
  const evmLabel = evmLabelForEnv(env);
  const reg = await loadRegistryJson(env);

  const destLabels = new Set<string>();

  if (reg?.parachains && typeof reg.parachains === 'object') {
    for (const [pidStr, meta] of Object.entries<any>(reg.parachains)) {
      const pid = Number(pidStr);
      destLabels.add(labelForPara(env, pid, meta));
    }
  }

  const sourceChains = [evmLabel];

  let destChains = Array.from(destLabels).sort((a, b) => {
    const pidA = Number(a.match(/\((\d+)\)\s*$/)?.[1] ?? Infinity);
    const pidB = Number(b.match(/\((\d+)\)\s*$/)?.[1] ?? Infinity);
    return pidA - pidB;
  });

  if (!destChains.length) {
    console.warn('[Transfer] registry JSON neobsahuje parachains, používam fallback hodnoty');
    switch (env) {
      case 'paseo_sepolia':
        destChains.push('Paseo AssetHub (1000)');
        break;
      case 'westend_sepolia':
        destChains.push('Westend AssetHub (1000)');
        break;
      case 'polkadot_mainnet':
        destChains.push('Polkadot AssetHub (1000)');
        break;
    }
  }

  // 2) PARASPELL – ďalšie chainy z CHAINS pre daný env
  const paraspellChains = await getParaspellChainsForEnv(env);
  const hubLabel = HUB_LABEL_BY_ENV[env] ?? 'AssetHub';

  const paraspellLabels = paraspellChains.map(
    (name) => `${name} (via ${hubLabel})`,
  );

  for (const label of paraspellLabels) {
    if (!destChains.includes(label)) {
      destChains.push(label);
    }
  }

  // 3) TOKENS – z registry JSON
  const tokens = extractTokensFromRegistryJson(reg);

  return { sourceChains, destChains, tokens };
}



/* ===================== Component ===================== */

export default function Transfer() {

  
  const [env, setEnv] = useState<Env>('paseo_sepolia');

  const [sourceChain, setSourceChain] = useState('Sepolia');
  const [destChain, setDestChain] = useState('PaseoAssetHub');

  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('');
  const [tokens, setTokens] = useState<TokenInfo[]>([]);


  const [sourceAddress, setSourceAddress] = useState('');
  const [destAddress, setDestAddress] = useState('');

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [chooserFor, setChooserFor] = useState<'source' | 'dest' | null>(null);

  const [sourceChainOptions, setSourceChainOptions] = useState<string[]>([]);
  const [destChainOptions, setDestChainOptions] = useState<string[]>([]);
  const [loadingChains, setLoadingChains] = useState(false);

  const modalOpen = chooserFor !== null;
  const isBusy = loading || loadingChains;




  async function connectMetaMask(): Promise<string> {
    // @ts-ignore
    const { ethereum } = window;
    if (!ethereum || !ethereum.request) {
      throw new Error('MetaMask nie je dostupná v prehliadači.');
    }

    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts?.length) {
      throw new Error('Nebola vybraná žiadna EVM adresa.');
    }
    return accounts[0];
  }

  async function connectTalisman(): Promise<string> {
    const { web3Enable, web3Accounts } = await import('@polkadot/extension-dapp');

    const exts = await web3Enable('Turbo Exchange');
    if (!exts.length) {
      throw new Error('Talisman/Polkadot rozšírenie nie je povolené alebo nainštalované.');
    }

    const accounts = await web3Accounts();
    if (!accounts.length) {
      throw new Error('Neboli nájdené Substrate účty v Talisman-e.');
    }

    return accounts[0].address;
  }

useEffect(() => {
  let cancelled = false;

  async function load() {
    setLoadingChains(true);
    setError(null);

    try {
      const { sourceChains, destChains, tokens } = await fetchChainsForEnv(env);
      if (cancelled) return;

      setSourceChainOptions(sourceChains);
      setDestChainOptions(destChains);
      setTokens(tokens);

      if (!sourceChains.includes(sourceChain)) {
        setSourceChain(sourceChains[0] ?? '');
      }
      if (!destChains.includes(destChain)) {
        setDestChain(destChains[0] ?? '');
      }
    } catch (e: any) {
      if (!cancelled) {
        setError(e?.message || 'Nepodarilo sa načítať dostupné chainy.');
        setSourceChainOptions([]);
        setDestChainOptions([]);
        setTokens([]);
      }
    } finally {
      if (!cancelled) setLoadingChains(false);
    }
  }

  load();
  return () => {
    cancelled = true;
  };
}, [env]);  // stále len env
// ONLY env

  const uniqueTokenSymbols = Array.from(
  new Set(tokens.map((t) => t.symbol).filter(Boolean)),
);


  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setChooserFor(null);
      }
    }

    if (modalOpen) {
      document.addEventListener('keydown', onKey);
    }
    return () => document.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  function closeModal() {
    if (!loading) {
      setChooserFor(null);
    }
  }

  async function pickWallet(kind: WalletKind) {
    if (!chooserFor) return;

    setLoading(true);
    setError(null);

    try {
      const addr = kind === 'metamask' ? await connectMetaMask() : await connectTalisman();

      if (chooserFor === 'source') setSourceAddress(addr);
      else setDestAddress(addr);

      setChooserFor(null);
    } catch (e: any) {
      setError(e?.message || 'Nepodarilo sa pripojiť peňaženku.');
    } finally {
      setLoading(false);
    }
  }

  function swapChains() {
    if (isBusy) return;

    const s = sourceChain;
    const d = destChain;

    setSourceChain(d);
    setDestChain(s);
  }

 async function handleSubmit() {
  if (isBusy) return;
  setError(null);

  const selectedToken = tokens.find((t) => t.symbol === token);
  if (!selectedToken) {
    setError('Prosím vyber token.');
    return;
  }

  if (!amount.trim()) {
    setError('Prosím zadaj amount.');
    return;
  }

  // prepočet na base units podľa token.decimals
  let amountBase: bigint;
  try {
    amountBase = toBaseUnits(amount, selectedToken.decimals);
  } catch (e: any) {
    setError(e?.message || 'Neplatná hodnota amount.');
    return;
  }

  if (!sourceAddress || !destAddress) {
    setError('Prosím vyber source aj destination adresu.');
    return;
  }

  console.log('Prepared transfer:', {
    env,
    sourceChain,
    destChain,
    sourceAddress,
    destAddress,
    tokenSymbol: selectedToken.symbol,
    tokenAddress: selectedToken.address,
    decimals: selectedToken.decimals,
    chainId: selectedToken.chainId,
    parachainId: selectedToken.parachainId,
    amountHuman: amount,
    amountBase, // toto posielaš do SDK
  });

  // TODO: tu neskôr:
  // await buildAndSendTransfer({ env, sourceChain, destChain, selectedToken, amountBase, ... })
}





  return (
    <section className="transfer-wrap">
      <h1 className="page-title">Transfer</h1>

      <div className="panel">
        <EnvToggle env={env} loading={isBusy} onChange={setEnv} />

        <SourceChainInput
          value={sourceChain}
          onChange={setSourceChain}
          disabled={isBusy}
          options={sourceChainOptions}
        />

        <SwapButton onClick={swapChains} disabled={isBusy} />

        <DestChainInput
          value={destChain}
          onChange={setDestChain}
          disabled={isBusy}
          options={destChainOptions}
        />

        <AmountAndTokenRow
          amount={amount}
          token={token}
           onAmountChange={setAmount}
           onTokenChange={setToken}
           disabled={isBusy}
           tokenOptions={uniqueTokenSymbols}
        />

        <SourceAddressRow
          address={sourceAddress}
          onClick={() => setChooserFor('source')}
          disabled={isBusy}
        />

        <DestinationAddressRow
          address={destAddress}
          onClick={() => setChooserFor('dest')}   // 🔹 tu sa otvorí WalletModal pre destination
          disabled={isBusy}
        />

        <TransferError message={error} />

        <SubmitButton loading={isBusy} onClick={handleSubmit} />
      </div>

      <WalletModal
        open={modalOpen}
        loading={loading}
        onPick={pickWallet}
        onClose={closeModal}
      />
    </section>
  );
}
