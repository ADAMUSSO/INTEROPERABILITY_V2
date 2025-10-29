import './Transfer.css';

export default function Transfer() {
  return (
    <section className="transfer-wrap">
      <h1 className="page-title">Transfer</h1>

      <div className="panel">
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
        <div className="row">
          <input className="input" placeholder="Receiver Address" />
        </div>
        <div className="row">
          <button className="import-wallet">Import Wallet</button>
        </div>
        <div className="submit-wrap">
          <button className="submit-btn">Submit</button>
        </div>
      </div>
    </section>
  );
}
