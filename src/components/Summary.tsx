import type { ReactNode } from "react";

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
  icon,
  label,
  value,
  onClick,
}: {
  active: boolean;
  icon?: ReactNode;
  label: string;
  value: string | number;
  onClick: () => void;
}) {
  return (
    <button className={`summary-button ${active ? "active" : ""}`} onClick={onClick}>
      <span className="summary-button-label">
        {icon}
        {label}
      </span>
      <strong>{value}</strong>
    </button>
  );
}
