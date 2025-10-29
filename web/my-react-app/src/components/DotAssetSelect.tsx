import { useEffect, useMemo, useRef, useState } from 'react';
import { getAllAssetsSymbols } from '@paraspell/sdk';
import type { DotChain } from './DotChainSelect';
import './ChainSelect.css';

type Props = {
  chain: DotChain | '';
  value: string;
  onChange: (symbol: string) => void;
  placeholder?: string;
};

export default function DotAssetSelect({ chain, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [assets, setAssets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value || ''); }, [value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!chain) { setAssets([]); return; }
      setLoading(true);
      try {
        const syms = await getAllAssetsSymbols(chain as any);
        if (alive) setAssets(syms ?? []);
      } catch {
        if (alive) setAssets([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [chain]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter(s => !q || s.toLowerCase().includes(q));
  }, [assets, query]);

  function pick(sym: string) {
    onChange(sym);
    setQuery(sym);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault();
      pick(filtered[0]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = open && (chain ? true : false);

  return (
    <div className="combo" ref={ref}>
      <input
        className="input"
        value={query}
        placeholder={
          placeholder ?? (chain ? 'Select asset…' : 'Select chain first…')
        }
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => chain && setOpen(true)}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />

      {showList && (
        <ul className="combo-list">
          {loading && (
            <li><button type="button" disabled style={{opacity:.7}}>Loading…</button></li>
          )}

          {!loading && filtered.length === 0 && (
            <li><button type="button" disabled style={{opacity:.6}}>No assets</button></li>
          )}

          {!loading && filtered.map(sym => (
            <li key={sym}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(sym)}
              >
                {sym}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
