// src/components/Transfer/DestinationAddressRow.tsx
type Props = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
};

export default function DestinationAddressRow({
  value,
  onChange,
  disabled,
}: Props) {
  return (
    <div className="row">
      <input
        className="input"
        placeholder="Destination Address"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
