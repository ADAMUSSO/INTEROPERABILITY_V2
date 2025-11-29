// src/components/Transfer/SourceAddressRow.tsx
type Props = {
  address: string;
  onClick: () => void;
  disabled?: boolean;
};

export default function SourceAddressRow({ address, onClick, disabled }: Props) {
  return (
    <div className="row address-row">
      <div className="address-info">
        <h4>Source Address</h4>
        <div className="muted">{address || ''}</div>
      </div>

      <button
        className="import-wallet"
        type="button"
        onClick={onClick}
        disabled={disabled}
      >
        {address ? 'Change Wallet' : 'Import Wallet'}
      </button>
    </div>
  );
}
