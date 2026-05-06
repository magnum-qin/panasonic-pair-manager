import ButtonBase from "@mui/material/ButtonBase";
import type { ReactNode } from "react";

export function IconButton({
  children,
  disabled = false,
  label,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <ButtonBase
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
