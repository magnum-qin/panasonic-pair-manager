import type { ReactNode } from "react";
import { Button } from "./Button";

export function ToolbarButton({
  active,
  children,
  disabled,
  hidden,
  onClick,
  variant,
}: {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  hidden?: boolean;
  onClick?: () => void;
  variant?: "default" | "danger" | "solidDanger";
}) {
  return (
    <Button active={active} disabled={disabled} hidden={hidden} onClick={onClick} variant={variant}>
      {children}
    </Button>
  );
}
