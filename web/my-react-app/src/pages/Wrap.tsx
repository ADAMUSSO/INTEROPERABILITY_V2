import './Wrap.css';

export default function Wrap() {
  return (
    <section className="wrap-section">
      <h1 className="page-title">Wrap / Unwrap</h1>

      <div className="panel">
        <div className="row">
          <input className="input" placeholder="Amount" />
        </div>
        <div className="row">
          <select className="input">
            <option>ETH → WETH (Wrap)</option>
            <option>WETH → ETH (Unwrap)</option>
          </select>
        </div>
        <div className="row">
          <input className="input" placeholder="Receiver Address (optional)" />
        </div>
        <div className="submit-wrap">
          <button className="submit-btn">Confirm</button>
        </div>
      </div>
    </section>
  );
}
