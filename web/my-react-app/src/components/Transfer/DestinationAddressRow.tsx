// src/components/Transfer/DestinationAddressRow.tsx
type Props = {
  address: string;
  onClick: () => void;
  disabled?: boolean;
};

export default function DestinationAddressRow({ address, onClick, disabled }: Props) {
  return (
    <div className="row address-row">
      <div className="address-info">
        <h4>Destination Address</h4>
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
