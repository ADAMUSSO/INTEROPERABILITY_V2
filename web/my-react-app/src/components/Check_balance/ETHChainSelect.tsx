import { useState } from 'react';
import '../ChainSelect.css';

export type EthChain = 'ethereum' | 'sepolia' | 'arbitrum' | 'optimism';

interface Props {
  value: EthChain | '';
  onChange: (c: EthChain) => void;
}

const CHAINS: { id: EthChain; label: string }[] = [
  { id: 'ethereum', label: 'Ethereum Mainnet' },
  { id: 'sepolia', label: 'Sepolia Testnet' },
  { id: 'arbitrum', label: 'Arbitrum One' },
  { id: 'optimism', label: 'Optimism' },
];

export default function EthChainSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const selectedLabel =
    CHAINS.find((c) => c.id === value)?.label ?? 'Select Ethereum chain';

  return (
    <div className="combo eth">
      <button
        type="button"
        className="input"
        onClick={() => setOpen(!open)}
      >
        {selectedLabel}
      </button>

      {open && (
        <ul className="combo-list">
          {CHAINS.map((chain) => (
            <li key={chain.id}>
              <button
                onClick={() => {
                  onChange(chain.id);
                  setOpen(false);
                }}
              >
                {chain.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
