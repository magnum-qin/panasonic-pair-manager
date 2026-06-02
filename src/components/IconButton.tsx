import ButtonBase from "@mui/material/ButtonBase";
import type { ReactNode } from "react";

export function IconButton({
  ariaExpanded,
  children,
  disabled = false,
  label,
  onClick,
}: {
  ariaExpanded?: boolean;
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <ButtonBase
      aria-expanded={ariaExpanded}
      aria-label={label}
      className="icon-button"
      disabled={disabled}
      onClick={onClick}
      title={label}
    >
      {children}
    </ButtonBase>
  );
}
