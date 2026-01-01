
type Props = { message: string | null };

export default function TransferError({ message }: Props) {
  if (!message) return null;

  return <div className="panel error-panel">{message}</div>;
}
