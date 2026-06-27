import { ImageOff } from "lucide-react";
import type { ReactNode } from "react";

export function PhotoGridEmptyState({
  actionLabel,
  description,
  icon,
  onAction,
  title,
}: {
  actionLabel?: string;
  description: string;
  icon?: ReactNode;
  onAction?: () => void;
  title: string;
}) {
  return (
    <div className="grid">
      <div className="gallery-empty action-empty">
        {icon ?? <ImageOff size={38} />}
        <strong>{title}</strong>
        <span>{description}</span>
        {actionLabel && onAction ? <button onClick={onAction}>{actionLabel}</button> : null}
      </div>
    </div>
  );
}
