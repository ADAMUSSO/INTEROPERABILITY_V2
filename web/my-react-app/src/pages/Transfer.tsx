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

export default function Transfer() {
  const [env, setEnv] = useState<Env>('paseo_sepolia');

  const [sourceChain, setSourceChain] = useState('Sepolia');
  const [destChain, setDestChain] = useState('');

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

  const [chainMap, setChainMap] = useState<ChainOptionMap>({});
  const [status, setStatus] = useState<string | null>(null);



  const modalOpen = chooserFor !== null;
  const isBusy = loading || loadingChains;

  async function connectMetaMask(): Promise<string> {
    // @ts-ignore
    const { ethereum } = window;
    if (!ethereum || !ethereum.request) throw new Error('MetaMask nie je dostupná v prehliadači.');

    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts?.length) throw new Error('Nebola vybraná žiadna EVM adresa.');
    return accounts[0];
  }

  async function connectTalisman(): Promise<string> {
    const { web3Enable, web3Accounts } = await import('@polkadot/extension-dapp');
    const exts = await web3Enable('Turbo Exchange');
    if (!exts.length) throw new Error('Talisman/Polkadot rozšírenie nie je povolené alebo nainštalované.');

    const accounts = await web3Accounts();
    if (!accounts.length) throw new Error('Neboli nájdené Substrate účty v Talisman-e.');
    return accounts[0].address;
  }

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
          setError(e?.message || 'Nepodarilo sa načítať dostupné chainy.');
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

  const uniqueTokenSymbols = Array.from(new Set(tokens.map((t) => t.symbol).filter(Boolean)));

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
    setStatus(null);


    const selectedToken = tokens.find((t) => t.symbol === token);
    if (!selectedToken) return setError('Prosím vyber token.');

    if (!amount.trim()) return setError('Prosím zadaj amount.');

    let amountBase: bigint;
    try {
      amountBase = toBaseUnits(amount, selectedToken.decimals);
    } catch (e: any) {
      return setError(e?.message || 'Neplatná hodnota amount.');
    }

    if (!sourceAddress || !destAddress) {
      return setError('Prosím vyber source aj destination adresu.');
    }

    const srcOpt = chainMap[sourceChain];
    const dstOpt = chainMap[destChain];

    if (!srcOpt || srcOpt.kind !== 'evm') return setError('Neplatný source chain.');
    if (!dstOpt) return setError('Neplatný destination chain.');

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
      setStatus('Priparing transfer…');
      const result = await executeTransfer(prepared, (msg) => setStatus(msg));
      console.log('Transfer result:', result);
    } catch (e: any) {
      setError(e?.message || 'Transfer zlyhal.');
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
          tokenOptions={uniqueTokenSymbols}
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
