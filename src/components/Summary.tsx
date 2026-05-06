export function SummaryRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function SummaryButton({
  active,
  label,
  value,
  onClick,
}: {
  active: boolean;
  label: string;
  value: string | number;
  onClick: () => void;
}) {
  return (
    <button className={`summary-button ${active ? "active" : ""}`} onClick={onClick}>
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}
