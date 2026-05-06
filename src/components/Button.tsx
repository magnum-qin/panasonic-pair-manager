import ButtonBase from "@mui/material/ButtonBase";
import type { ReactNode } from "react";

type ButtonVariant = "default" | "danger" | "solidDanger";

export function Button({
  active = false,
  children,
  className = "",
  disabled = false,
  hidden = false,
  onClick,
  variant = "default",
}: {
  active?: boolean;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  hidden?: boolean;
  onClick?: () => void;
  variant?: ButtonVariant;
}) {
  const variantClass = variant === "solidDanger" ? "solid danger" : variant;

  return (
    <ButtonBase
      className={`ui-button ${variantClass} ${active ? "active-tool" : ""} ${className}`}
      disabled={disabled}
      hidden={hidden}
      onClick={onClick}
    >
      {children}
    </ButtonBase>
  );
}
