// src/components/Transfer/AmountAndTokenRow.tsx
type Props = {
  amount: string;
  token: string;
  onAmountChange: (v: string) => void;
  onTokenChange: (v: string) => void;
  disabled?: boolean;
};

export default function AmountAndTokenRow({
  amount,
  token,
  onAmountChange,
  onTokenChange,
  disabled,
}: Props) {
  return (
    <div className="row grid-2">
      <input
        className="input"
        placeholder="Amount"
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        disabled={disabled}
      />

      <input
        className="input"
        placeholder="Token"
        value={token}
        onChange={(e) => onTokenChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
