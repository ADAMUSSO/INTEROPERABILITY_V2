import { useEffect, useState } from 'react';
import './Transfer.css';

// Pomocná funkcia na skrátenie adresy


export default function Transfer() {
  const [sourceAddress, setSourceAddress] = useState<string>('');
  const [destAddress, setDestAddress] = useState<string>('');
  const [chooserFor, setChooserFor] = useState<'source' | 'dest' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // ====== Wallet connectors ======
  async function connectMetaMask(): Promise<string> {
    // @ts-ignore
    const { ethereum } = window;
    if (!ethereum || !ethereum.request) {
      throw new Error('MetaMask nie je dostupná v prehliadači.');
    }
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts?.length) throw new Error('Nebola vybraná žiadna EVM adresa.');
    return accounts[0];
  }

  async function connectTalisman(): Promise<string> {
    const { web3Enable, web3Accounts } = await import('@polkadot/extension-dapp');
    const exts = await web3Enable('Turbo Exchange');
    if (!exts.length) {
      throw new Error('Talisman/Polkadot rozšírenie nie je povolené alebo nainštalované.');
    }
    const accounts = await web3Accounts();
    if (!accounts.length) throw new Error('Neboli nájdené Substrate účty v Talisman-e.');
    return accounts[0].address;
  }

  // ====== Modal helpers ======
  const modalOpen = chooserFor !== null;

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

  async function pickWallet(kind: 'metamask' | 'talisman') {
    if (!chooserFor) return;
    setLoading(true);
    setError('');
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

  return (
    <section className="transfer-wrap">
      <h1 className="page-title">Transfer</h1>

      <div className="panel">
        <div className="row">
          <input className="input" placeholder="Environment" />
        </div>
        <div className="row">
          <input className="input" placeholder="Source Chain" />
        </div>
        <div className="row">
          <input className="input" placeholder="Destination Chain" />
        </div>
        <div className="row grid-2">
          <input className="input" placeholder="Amount" />
          <input className="input" placeholder="Token" />
        </div>

        {/* SOURCE ADDRESS */}
        <div className="row" style={{ alignItems: 'center', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <h4 >Source Address</h4>
            <div className="muted">{sourceAddress  }</div>
          </div>
          <button
            className="import-wallet"
            onClick={() => setChooserFor('source')}
            disabled={loading}
          >
            {sourceAddress ? 'Change Wallet' : 'Import Wallet'}
          </button>
        </div>

        {/* DESTINATION ADDRESS */}
        <div className="row" style={{ alignItems: 'center', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <h4 >Destination Address</h4>
            <div className="muted">{destAddress}</div>
          </div>
          <button
            className="import-wallet"
            onClick={() => setChooserFor('dest')}
            disabled={loading}
          >
            {destAddress ? 'Change Wallet' : loading ? 'Connecting' : 'Import Wallet'}
          </button>
        </div>

        {error && <div className="panel" style={{ marginTop: '1rem', color: '#ffb4b4' }}>{error}</div>}

        <div className="submit">
          <button className="submit-btn" disabled={loading}>
            {loading ? 'Connecting…' : 'Submit'}
          </button>
        </div>
      </div>

      {/* ====== MODAL ====== */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal} aria-hidden>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="wallet-modal-title" className="modal-title">Choose wallet</h3>

            <div className="wallet-list">
              <button
                className="wallet-item"
                onClick={() => pickWallet('metamask')}
                disabled={loading}
              >
                <span className="wallet-icon" aria-hidden>
                  {/* MetaMask fox – jednoduchá SVG silueta */}
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path d="M3 3l7 5 2-1 2 1 7-5-6 7 1 4-4-2-4 2 1-4-6-7z" />
                  </svg>
                </span>
                <span className="wallet-title">METAMASK</span>
              </button>

              <button
                className="wallet-item"
                onClick={() => pickWallet('talisman')}
                disabled={loading}
              >
                <span className="wallet-icon" aria-hidden>
                  {/* Talisman – kruh s „T“ */}
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <circle cx="12" cy="12" r="10" />
                    <rect x="7" y="10" width="10" height="2" rx="1" />
                    <rect x="11" y="7" width="2" height="10" rx="1" />
                  </svg>
                </span>
                <span className="wallet-title">TALISMAN</span>
              </button>
            </div>

            <button className="modal-close" onClick={closeModal} disabled={loading}>
              Zavrieť
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
