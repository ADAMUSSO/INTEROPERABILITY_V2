import { useState } from 'react';
import { ethers } from 'ethers';
import './Wrap.css';

export default function Wrap() {
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'wrap' | 'unwrap'>('wrap');
  const [account, setAccount] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connectWallet() {
  try {
    if (!window.ethereum) throw new Error('MetaMask not found');
    const provider = new ethers.BrowserProvider(window.ethereum); // teraz je typ OK
    const accounts =
      (await window.ethereum.request?.({ method: 'eth_requestAccounts' })) ??
      (await provider.send('eth_requestAccounts', []));
    setAccount(accounts[0]);
  } catch (e: any) {
    setError(e.message);
  }
}

async function onConfirm() {
  try {
    if (!account) throw new Error('Connect your wallet first');
    if (!amount || Number(amount) <= 0) throw new Error('Enter valid amount');

    setLoading(true);
    setTxHash(null);
    setError(null);

    // po predchádzajúcom checku je bezpečné použiť !
    const provider = new ethers.BrowserProvider(window.ethereum!);
    const signer = await provider.getSigner();

    if (mode === 'wrap') {
      const { wrapETH } = await import('../eth/wrap_eth');
      const hash = await wrapETH(amount, signer);
      setTxHash(hash);
    } else {
      const { unwrapETH } = await import('../eth/unwrap_eth');
      const hash = await unwrapETH(amount, signer);
      setTxHash(hash);
    }
  } catch (e: any) {
    setError(e.message);
  } finally {
    setLoading(false);
  }
}


  return (
    <section className="wrap-section">
      <h1 className="page-title">Wrap / Unwrap ETH</h1>

      <div className="panel">
        <div className="row">
          <input
            className="input"
            type="number"
            placeholder="Amount in ETH"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="row">
          <div className="toggle-is-eth">
            <button
              className={mode === 'wrap' ? 'active' : ''}
              onClick={() => setMode('wrap')}
            >
              ETH → WETH
            </button>
            <button
              className={mode === 'unwrap' ? 'active' : ''}
              onClick={() => setMode('unwrap')}
            >
              WETH → ETH
            </button>
            <span className="knob" />
          </div>
        </div>

        <div className="submit">
          {!account ? (
            <button className="submit-btn" onClick={connectWallet}>
              Import Wallet
            </button>
          ) : (
            <button className="submit-btn" onClick={onConfirm} disabled={loading}>
              {loading ? (mode === 'wrap' ? 'Wrapping…' : 'Unwrapping…') : mode === 'wrap' ? 'Wrap' : 'Unwrap'}
            </button>
          )}
        </div>
      </div>

      {account && (
        <div className="panel small">
          <div><strong>Wallet:</strong> {account}</div>
        </div>
      )}
      {txHash && (
        <div className="panel small">
          <div>Success!</div>
          <div className="tx-panel">
            <span>Tx Hash:</span>
            <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">
              {txHash}
            </a>
        <button
          className="copy-btn"
          onClick={() => {
            navigator.clipboard.writeText(txHash);
            const toast = document.createElement('div');
            toast.className = 'toast show';
            toast.innerText = 'Hash copied!';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
          }}
          title="Copy hash"
        > 
         <img className='copy-img' src="src\assets\copy_symbol.png" alt="Copy" />
        </button>
    </div>
  </div>
)}

      {error && (
        <div className="panel small" style={{ color: '#ffb4b4' }}>
          ❌ {error}
        </div>
      )}
    </section>
  );
}
