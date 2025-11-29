// src/components/Transfer/SubmitButton.tsx
type Props = {
  loading: boolean;
  onClick: () => void;
};

export default function SubmitButton({ loading, onClick }: Props) {
  return (
    <div className="submit">
      <button
        className="submit-btn"
        disabled={loading}
        type="button"
        onClick={onClick}
      >
        {loading ? 'Processing…' : 'Submit'}
      </button>
    </div>
  );
}
