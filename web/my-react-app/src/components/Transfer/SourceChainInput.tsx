import { useEffect, useRef, useState } from 'react';
import './ChainSelectTransfer.css';

type Props = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  options: string[];
};

export default function SourceChainInput({ value, onChange, disabled, options }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const currentLabel = value || 'Source Chain';

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

  function selectOption(opt: string) {
    onChange(opt);
    setOpen(false);
  }

  return (
    <div className="row">
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

        {open && options.length > 0 && (
          <ul className="combo-list" role="listbox">
            {options.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => selectOption(opt)}
                  aria-selected={opt === value}
                >
                  {opt}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
