import { useEffect, useState } from 'react';
import './Transfer.css';

import { fetchTransferDataForEnv } from '../components/Transfer/transferData';
import { executeTransfer } from '../components/Transfer/executeTransfer';

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
import type { TokenInfo, ChainOptionMap, PreparedTransfer } from '../components/Transfer/sharedTypes';

/* ===================== Amount helpers ===================== */

function toBaseUnits(amountStr: string, decimals: number): bigint {
  let s = amountStr.trim();
  if (!s) throw new Error('Amount is empty');

  s = s.replace(',', '.');

  if (!/^\d*\.?\d+$/.test(s)) throw new Error('Invalid amount format');
  if (s.startsWith('.')) s = '0' + s;

  const [intPartRaw, fracPartRaw = ''] = s.split('.');
  const intPart = intPartRaw || '0';

  if (fracPartRaw.length > decimals) {
    throw new Error(`Too many decimal places (max ${decimals})`);
  }

  const fracPart = fracPartRaw.padEnd(decimals, '0');
  const fullStr = intPart + fracPart;

  const normalized = fullStr.replace(/^0+/, '') || '0';
  return BigInt(normalized);
}

function isEvmAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

// veľmi jednoduché SS58 overenie (nie 100% validátor, ale stačí na UX guard)
function looksLikeSs58(addr: string): boolean {
  const a = addr.trim();
  return a.length >= 40 && a.length <= 60 && !a.startsWith('0x');
}

/* ===================== Paraspell token loader ===================== */

async function loadParaspellSymbolsForAssetHub(env: Env): Promise<string[]> {
  try {
    const sdk = await import('@paraspell/sdk');
    const { getAllAssetsSymbols } = sdk as any;

    // re-use tvojej mapy z endpoints
    const { ASSET_HUB_PARASPELL_NAME } = await import('../components/Transfer/endpoints');
    const fromChain = ASSET_HUB_PARASPELL_NAME?.[env];

    if (!fromChain || !getAllAssetsSymbols) return [];

    const syms: string[] = await getAllAssetsSymbols(fromChain);
    return (syms ?? []).filter(Boolean);
  } catch {
    return [];
  }
}

export default function Transfer() {
  const [env, setEnv] = useState<Env>('paseo_sepolia');

  const [sourceChain, setSourceChain] = useState('Sepolia');
  const [destChain, setDestChain] = useState('');

  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('');
  const [tokens, setTokens] = useState<TokenInfo[]>([]);

  const [tokenOptions, setTokenOptions] = useState<string[]>([]);

  const [sourceAddress, setSourceAddress] = useState('');
  const [destAddress, setDestAddress] = useState('');

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [chooserFor, setChooserFor] = useState<'source' | 'dest' | null>(null);

  const [sourceChainOptions, setSourceChainOptions] = useState<string[]>([]);
  const [destChainOptions, setDestChainOptions] = useState<string[]>([]);
  const [loadingChains, setLoadingChains] = useState(false);

  const [chainMap, setChainMap] = useState<ChainOptionMap>({});
  const [status, setStatus] = useState<string | null>(null);

  const modalOpen = chooserFor !== null;
  const isBusy = loading || loadingChains;

  const srcOpt = chainMap[sourceChain];
  const dstOpt = chainMap[destChain];

  async function connectMetaMask(): Promise<string> {
    // @ts-ignore
    const { ethereum } = window;
    if (!ethereum || !ethereum.request) throw new Error('MetaMask is not available in the browser.');

    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts?.length) throw new Error('No EVM address was selected.');
    return accounts[0];
  }

  async function connectTalisman(): Promise<string> {
    const { web3Enable, web3Accounts } = await import('@polkadot/extension-dapp');
    const exts = await web3Enable('Turbo Exchange');
    if (!exts.length) throw new Error('Talisman extension not found.');

    const accounts = await web3Accounts();
    if (!accounts.length) throw new Error('Could not find substrate account in Talisman.');
    return accounts[0].address;
  }

  /* ===================== Load chains + snowbridge tokens ===================== */

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingChains(true);
      setError(null);

      try {
        const { data, map } = await fetchTransferDataForEnv(env);
        if (cancelled) return;

        const srcLabels = data.sourceChains.map((c) => c.label);
        const dstLabels = data.destChains.map((c) => c.label);

        setChainMap(map);
        setSourceChainOptions(srcLabels);
        setDestChainOptions(dstLabels);
        setTokens(data.tokens);

        setSourceChain((prev) => (srcLabels.includes(prev) ? prev : srcLabels[0] ?? ''));
        setDestChain((prev) => (dstLabels.includes(prev) ? prev : dstLabels[0] ?? ''));
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Unable to load chains.');
          setChainMap({});
          setSourceChainOptions([]);
          setDestChainOptions([]);
          setTokens([]);
          setDestChain('');
        }
      } finally {
        if (!cancelled) setLoadingChains(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [env]);

  /* ===================== Token options: EVM vs AssetHub ===================== */

  useEffect(() => {
    let cancelled = false;

    async function recompute() {
      if (!srcOpt) {
        setTokenOptions([]);
        setToken('');
        return;
      }

      // EVM source -> tokeny zo Snowbridge registry
      if (srcOpt.kind === 'evm') {
        const syms = Array.from(new Set(tokens.map((t) => t.symbol).filter(Boolean)));
        setTokenOptions(syms);
        if (!syms.includes(token)) setToken('');
        return;
      }

      // Substrate source (AssetHub) -> tokeny zo ParaSpell (+ PAS fallback)
      const syms = await loadParaspellSymbolsForAssetHub(env);
      const withFallback = Array.from(new Set(['PAS', ...syms].filter(Boolean)));

      if (!cancelled) {
        setTokenOptions(withFallback);
        if (!withFallback.includes(token)) setToken('PAS');
      }
    }

    recompute();
    return () => {
      cancelled = true;
    };
  }, [env, sourceChain, srcOpt?.kind, tokens]);

  /* ===================== UX: ESC closes modal ===================== */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setChooserFor(null);
    }
    if (modalOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  function closeModal() {
    if (!loading) setChooserFor(null);
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
      setError(e?.message || 'Unable to connect wallet.');
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

  /* ===================== Submit ===================== */

  async function handleSubmit() {
    if (isBusy) return;
    setError(null);
    setStatus(null);

    if (!srcOpt) return setError('Incorrect source chain.');
    if (!dstOpt) return setError('Incorrect destination chain.');

    if (!token) return setError('Please select a token.');
    if (!amount.trim()) return setError('Please enter an amount.');

    if (!sourceAddress || !destAddress) {
      return setError('Please select source and destination addresses.');
    }

    // jednoduché guardy adries podľa source/dest
    if (srcOpt.kind === 'evm' && !isEvmAddress(sourceAddress)) {
      return setError('Source address must be EVM (0x…) — connect MetaMask.');
    }
    if (srcOpt.kind !== 'evm' && !looksLikeSs58(sourceAddress)) {
      return setError('Source address must be Substrate (SS58) — connect Talisman.');
    }

    // TokenInfo: EVM token hľadáme v registry, Substrate token vytvoríme “pseudo”
    let selectedToken: TokenInfo | null = null;

    if (srcOpt.kind === 'evm') {
      selectedToken = tokens.find((t) => t.symbol === token) ?? null;
      if (!selectedToken) return setError('Selected token is not available for EVM source.');
    } else {
      // pre test stačí 10 decimals; keď budeš chcieť presne, doplníme lookup z metadata
      selectedToken = {
        chainId: 1000,
        address: 'NATIVE_OR_XCM',
        name: token,
        symbol: token,
        decimals: 10,
        origin: 'parachain',
        parachainId: 1000,
      };
    }

    let amountBase: bigint;
    try {
      amountBase = toBaseUnits(amount, selectedToken.decimals);
    } catch (e: any) {
      return setError(e?.message || 'Invalid amount value.');
    }

    const prepared: PreparedTransfer = {
      env,
      source: srcOpt,
      dest: dstOpt,
      sourceAddress,
      destAddress,
      token: selectedToken,
      amountHuman: amount,
      amountBase,
    };

    try {
      setLoading(true);
      setStatus('Preparing transfer…');
      const result = await executeTransfer(prepared, (msg) => setStatus(msg));
      console.log('Transfer result:', result);
      setStatus('Finished ✅');
    } catch (e: any) {
      setError(e?.message || 'Transfer failed.');
    } finally {
      setLoading(false);
    }
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
          tokenOptions={tokenOptions}
        />

        <SourceAddressRow
          address={sourceAddress}
          onClick={() => setChooserFor('source')}
          disabled={isBusy}
        />

        <DestinationAddressRow
          address={destAddress}
          onClick={() => setChooserFor('dest')}
          disabled={isBusy}
        />

        <TransferError message={error} />
        <TransferError message={status} />

        <SubmitButton loading={isBusy} onClick={handleSubmit} />
      </div>

      <WalletModal open={modalOpen} loading={loading} onPick={pickWallet} onClose={closeModal} />
    </section>
  );
}
