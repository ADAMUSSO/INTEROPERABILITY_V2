import { useEffect, useState } from 'react';
import './Transfer.css';

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

/* ===================== Registry helpers ===================== */

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

async function fetchChainsForEnv(
  env: Env,
): Promise<{ sourceChains: string[]; destChains: string[] }> {
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

  const destChains = Array.from(destLabels).sort((a, b) => {
    const pidA = Number(a.match(/\((\d+)\)\s*$/)?.[1] ?? Infinity);
    const pidB = Number(b.match(/\((\d+)\)\s*$/)?.[1] ?? Infinity);
    return pidA - pidB;
  });

  if (!destChains.length) {
    console.warn('[Transfer] registry JSON neobsahuje parachains, používam fallback hodnoty');
    switch (env) {
      case 'paseo_sepolia':
        destChains.push('PaseoAssetHub');
        break;
      case 'westend_sepolia':
        destChains.push('WestendAssetHub');
        break;
      case 'polkadot_mainnet':
        destChains.push('PolkadotAssetHub');
        break;
    }
  }

  return { sourceChains, destChains };
}

/* ===================== Component ===================== */

export default function Transfer() {
  const [env, setEnv] = useState<Env>('paseo_sepolia');

  const [sourceChain, setSourceChain] = useState('Sepolia');
  const [destChain, setDestChain] = useState('PaseoAssetHub');

  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('');

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
        const { sourceChains, destChains } = await fetchChainsForEnv(env);
        if (cancelled) return;

        setSourceChainOptions(sourceChains);
        setDestChainOptions(destChains);

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
        }
      } finally {
        if (!cancelled) setLoadingChains(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [env, sourceChain, destChain]);

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

    console.log('TODO: Submit transfer', {
      env,
      sourceChain,
      destChain,
      sourceAddress,
      destAddress,
      amount,
      token,
    });
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
        />

        <SourceAddressRow
          address={sourceAddress}
          onClick={() => setChooserFor('source')}
          disabled={isBusy}
        />

        <DestinationAddressRow
          value={destAddress}
          onChange={setDestAddress}
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
