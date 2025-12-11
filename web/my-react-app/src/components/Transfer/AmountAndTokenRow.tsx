// src/components/Transfer/AmountAndTokenRow.tsx
import { useEffect, useRef, useState } from 'react';
import './ChainSelectTransfer.css';

type Props = {
  amount: string;
  token: string;
  onAmountChange: (v: string) => void;
  onTokenChange: (v: string) => void;
  disabled?: boolean;
  tokenOptions?: string[]; // 🔹 nové – voliteľný zoznam tokenov
};

export default function AmountAndTokenRow({
  amount,
  token,
  onAmountChange,
  onTokenChange,
  disabled,
  tokenOptions = [],
}: Props) {
  const hasOptions = tokenOptions.length > 0;

  // rovnaká logika ako v SourceChainInput
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const currentLabel = token || 'Token';

  // zavretie pri kliknutí mimo
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function selectToken(opt: string) {
    onTokenChange(opt);
    setOpen(false);
  }

  return (
    <div className="row grid-2">
      <input
        className="input"
        placeholder="Amount"
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        disabled={disabled}
      />

      {hasOptions ? (
        <div className="combo" ref={ref}>
          <button
            type="button"
            className="input combo-trigger"
            onClick={() => !disabled && setOpen((o) => !o)}
            disabled={disabled}
          >
            <span>{currentLabel}</span>
            <span className="combo-icon" aria-hidden>
              ▾
            </span>
          </button>

          {open && (
            <ul className="combo-list" role="listbox">
              {tokenOptions.map((opt) => (
                <li key={opt}>
                  <button
                    type="button"
                    onClick={() => selectToken(opt)}
                    aria-selected={opt === token}
                  >
                    {opt}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <input
          className="input"
          placeholder="Token"
          value={token}
          onChange={(e) => onTokenChange(e.target.value)}
          disabled={disabled}
        />
      )}
    </div>
  );
}
