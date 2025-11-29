// src/components/Transfer/WalletModal.tsx
import type { WalletKind } from './types';
import metamaskLogo from '../../assets/metamask_logo.png';
import talismanLogo from '../../assets/talisman_logo.png';


type Props = {
  open: boolean;
  loading: boolean;
  onPick: (kind: WalletKind) => void;
  onClose: () => void;
};

export default function WalletModal({
  open,
  loading,
  onPick,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      aria-hidden={true}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-modal-title"
        onClick={e => e.stopPropagation()}
      >
        <h3 id="wallet-modal-title" className="modal-title">
          Choose wallet
        </h3>

        <div className="wallet-list">
          <button
            className="wallet-item"
            onClick={() => onPick('metamask')}
            disabled={loading}
          >
            <span className="wallet-icon" aria-hidden={true}>
              <img src={metamaskLogo} alt="MetaMask" />
            </span>
            <span className="wallet-title">METAMASK</span>
          </button>

          <button
            className="wallet-item"
            onClick={() => onPick('talisman')}
            disabled={loading}
          >
            <span className="wallet-icon" aria-hidden={true}>
              <img src={talismanLogo} alt="Talisman" />
            </span>
            <span className="wallet-title">TALISMAN</span>
          </button>
        </div>

        <button
          className="modal-close"
          onClick={onClose}
          disabled={loading}
        >
          Close
        </button>
      </div>
    </div>
  );
}
