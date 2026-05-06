import ButtonBase from "@mui/material/ButtonBase";
import { CheckCircle2, X } from "lucide-react";
import { useRef, type ReactNode } from "react";

export function SidebarItem({
  active,
  disabled,
  icon,
  label,
  onClear,
  onClick,
  subtitle,
}: {
  active?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  onClear?: () => void;
  onClick?: () => void;
  subtitle: string;
}) {
  const pointerHandledRef = useRef(false);

  return (
    <ButtonBase
      className={`source-card ${active ? "active" : ""}`}
      component="div"
      disabled={disabled}
      onClick={() => {
        if (pointerHandledRef.current) {
          pointerHandledRef.current = false;
          return;
        }
        onClick?.();
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || disabled) return;
        pointerHandledRef.current = true;
        onClick?.();
      }}
    >
      {icon ?? <div className="drive-icon" />}
      <div className="source-card-copy">
        <strong>{label}</strong>
        <span>{subtitle}</span>
      </div>
      {onClear ? (
        <button
          aria-label={`Remove ${label}`}
          className="source-card-remove"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onClear();
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          title="Remove folder"
          type="button"
        >
          <X size={15} />
        </button>
      ) : (
        <CheckCircle2 size={17} />
      )}
    </ButtonBase>
  );
}
