// src/components/Transfer/SwapButton.tsx
import swapIcon from '../../assets/data-transfer.png';

type Props = {
  onClick: () => void;
  disabled?: boolean;
};

export default function SwapButton({ onClick, disabled }: Props) {
  return (
    <div className="swap-row">
      <button
        className="swap-btn"
        type="button"
        onClick={onClick}
        disabled={disabled}
      >
        <img src={swapIcon} alt="Swap chains" />
      </button>
    </div>
  );
}
