import './App.css';

export default function App() {
  return (
    <div className="app">
      <header className="site-header">
        <div className="container header-inner">
          <div className="brand">Turbo exchange</div>
          <nav className="nav">
            <a href="#transfer">Transfer</a>
            <a href="#balance">Check Balance</a>
            <a href="#docs">Docs</a>
          </nav>
        </div>
      </header>

      <main className="main">
        <section id="transfer" className="transfer-wrap">
          <h1 className="page-title">Transfer</h1>

          <div className="panel">
            <div className="row">
              <input id="src-chain" className="input" placeholder="Source Chain" />
            </div>

            <div className="row">
              <input id="dst-chain" className="input" placeholder="Destination Chain" />
            </div>

            <div className="row grid-2">
              <div className="field-with-badge">
                <input id="amount" className="input" placeholder="Amount" />
              </div>

              {/* Token ako input */}
              <div>
                <input id="token" className="input" placeholder="Token" />
              </div>
            </div>

            <div className="row">
              <input id="reciever" className="input" placeholder="Receiver Address" />
            </div>

            <div className='row'>
              <button className='import-wallet' >Import wallet</button>
            </div>

            

            {/* Submit button do stredu */}
            <div className="submit-wrap">
              <button type="submit" className="submit-btn">Submit</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
