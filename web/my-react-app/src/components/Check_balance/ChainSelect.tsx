import { useEffect, useMemo, useRef, useState } from 'react';
import '../ChainSelect.css'; // Uisti sa, že cesta k CSS sedí

type Props = {
  value: string;
  options: string[];       // <--- Tu pošleš buď DOT chains alebo EVM chains
  onChange: (val: string) => void;
  placeholder?: string;
};

export default function GenericChainSelect({ value, options, onChange, placeholder }: Props) {
  const [query, setQuery] = useState<string>(value || '');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(value || ''), [value]);

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
    return options.filter((c) => !q || c.toLowerCase().includes(q));
  }, [query, options]);

  function selectOption(opt: string) {
    onChange(opt);
    setQuery(opt);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault();
      selectOption(filtered[0]);
    }
    if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div className="combo" ref={wrapRef}>
      <input
        className="input"
        value={query}
        placeholder={placeholder ?? 'Select chain…'}
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
          {filtered.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectOption(opt)}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}