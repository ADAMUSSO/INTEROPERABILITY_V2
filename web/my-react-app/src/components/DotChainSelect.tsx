// src/components/DotChainSelect.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { CHAINS } from '@paraspell/sdk';
import './ChainSelect.css';

export type DotChain = typeof CHAINS[number];

type Props = {
  value: DotChain | '';
  onChange: (val: DotChain) => void;
  placeholder?: string;
};

export default function DotChainSelect({ value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState<string>(value || '');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(value || ''), [value]);

  // click mimo => zatvoriť
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CHAINS.filter((c) => !q || c.toLowerCase().includes(q));
  }, [query]);

  function selectChain(chain: DotChain) {
    onChange(chain);
    setQuery(chain);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault();
      selectChain(filtered[0] as DotChain);
    }
    if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div className="combo" ref={wrapRef}>
      <input
        className="input"
        value={query}
        placeholder={placeholder ?? 'Select DOT chain…'}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />

      {open && filtered.length > 0 && (
        <ul className="combo-list">
          {filtered.map((c) => (
            <li key={c}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()} // nezatvára focus pred onClick
                onClick={() => selectChain(c as DotChain)}
              >
                {c}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
