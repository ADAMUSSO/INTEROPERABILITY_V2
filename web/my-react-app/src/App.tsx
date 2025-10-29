import { useState } from 'react';
import Header from './components/Header';
import Transfer from './pages/Transfer';
import Wrap from './pages/Wrap';
import Balance from './pages/Balance';
import type { Page } from './types/Page';
import './App.css';

export default function App() {
  const [page, setPage] = useState<Page>('transfer');

  return (
    <div className="app">
      <Header page={page} onSelect={setPage} />
      <main className="main">
        {page === 'transfer' && <Transfer />}
        {page === 'balance' && <Balance />}
        {page === 'wrap' && <Wrap />}
        {page === 'docs' && (
          <section className="panel">
            <h1 className="page-title">Docs</h1>
            <p>Coming soon...</p>
          </section>
        )}
      </main>
    </div>
  );
}
  