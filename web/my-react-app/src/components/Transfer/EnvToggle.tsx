// src/components/Transfer/EnvToggle.tsx
import type { Env } from './types';

const ENV_OPTIONS: { id: Env; label: string }[] = [
  { id: 'paseo_sepolia', label: 'Paseo → Sepolia' },
  { id: 'westend_sepolia', label: 'Westend → Sepolia' },
  { id: 'polkadot_mainnet', label: 'Polkadot Mainnet' },
];

type Props = {
  env: Env;
  loading: boolean;
  onChange: (nextEnv: Env) => void;
};

export default function EnvToggle({ env, loading, onChange }: Props) {
  return (
    <div className="row env-row">
      <span className="env-label">Environment</span>

      <div className={`env-toggle env-${env}`}>
        <div className="env-toggle-indicator" />

        {ENV_OPTIONS.map(option => (
          <button
            key={option.id}
            type="button"
            className={
              'env-toggle-option' + (env === option.id ? ' is-active' : '')
            }
            onClick={() => onChange(option.id)}
            disabled={loading}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
