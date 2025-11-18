import { useState } from 'react';
import './Balance.css';
import DotChainSelect, { type DotChain } from '../components/Check_balance/DotChainSelect';
import DotAssetSelect from '../components/Check_balance/DotAssetSelect';









export default function Balance() {
  const [mode, setMode] = useState<'eth' | 'dot'>('eth');

  // DOT
  const [dotChain, setDotChain] = useState<DotChain | ''>('');
  const [dotAsset, setDotAsset] = useState('');


  //ETH


  // common
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCheck() {
    setResult(null);
    setError(null);

    try {
      setLoading(true);

      if (mode === 'dot') {
        if (!dotChain) throw new Error('Vyber DOT chain.');
        if (!dotAsset) throw new Error('Vyber DOT asset.');
        if (!address.trim()) throw new Error('Zadaj SS58 adresu.');

        const { getAssetBalance, getAssetDecimals } = await import('@paraspell/sdk');
        const [balance, decimals] = await Promise.all([
          getAssetBalance({ address: address.trim(), chain: dotChain, currency: { symbol: dotAsset } }),
          getAssetDecimals(dotChain, dotAsset),
        ]);
        if (decimals == null) throw new Error('Nepodarilo sa načítať decimals.');
        const human = Number(balance) / 10 ** decimals;
        setResult(`${human} ${dotAsset}`);

      } 
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="balance-section">
      <div className="title-row">
        <h1 className="page-title">Check Balance</h1>
        <div className={`toggle ${mode === 'eth' ? 'is-eth' : 'is-dot'}`}>
          <button className={mode === 'eth' ? 'active' : ''} onClick={() => setMode('eth')}>ETH</button>
          <button className={mode === 'dot' ? 'active' : ''} onClick={() => setMode('dot')}>DOT</button>
          <span className="knob" />
        </div>
      </div>

      <div className="panel">
        {mode === 'dot' ? (
          <>
            <div className="row">
              <DotChainSelect value={dotChain} onChange={(c) => { setDotChain(c); setDotAsset(''); }} />
            </div>
            <div className="row">
              <DotAssetSelect chain={dotChain} value={dotAsset} onChange={setDotAsset} />
            </div>
          </>
        ) : (
          <div className="row">
            <input
              className="input"
              placeholder="Ethereum address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        )}

        <div className="row">
          <input
            className="input"
            placeholder={`${mode === 'eth' ? 'EVM' : 'SS58'} address`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div className="submit-wrap">
          <button className="submit-btn" onClick={onCheck} disabled={loading}>
            {loading ? (
              <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
              </div>
              ) : (
              'Check'
            )}
          </button>
        </div>
      </div>

      {error && <div className="panel" style={{ marginTop: '1rem', color: '#ffb4b4' }}>{error}</div>}
      {result && <div className="panel" style={{ marginTop: '1rem' }}>{result}</div>}
    </section>
  );
}
