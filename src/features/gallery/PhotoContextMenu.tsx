import { ExternalLink, Image, Trash2 } from "lucide-react";
import { useEffect } from "react";
import type { TranslationKey } from "../../i18n";
import type { PhotoGroup } from "../../types";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function PhotoContextMenu({
  deleteDisabled,
  group,
  onClose,
  onDelete,
  onOpen,
  onOpenExternal,
  t,
  x,
  y,
}: {
  deleteDisabled: boolean;
  group: PhotoGroup;
  onClose: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onOpenExternal: () => void;
  t: Translator;
  x: number;
  y: number;
}) {
  useEffect(() => {
    const close = () => onClose();
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const left = Math.min(x, Math.max(12, window.innerWidth - 190));
  const top = Math.min(y, Math.max(12, window.innerHeight - 166));

  return (
    <div
      className="photo-context-menu"
      role="menu"
      style={{ left, top }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="context-menu-title" title={group.stem}>
        {group.stem}
      </div>
      <button
        className="context-menu-item"
        onClick={() => {
          onOpen();
          onClose();
        }}
        role="menuitem"
        type="button"
      >
        <Image size={15} />
        {t("action.open")}
      </button>
      <button
        className="context-menu-item"
        onClick={() => {
          onOpenExternal();
          onClose();
        }}
        role="menuitem"
        type="button"
      >
        <ExternalLink size={15} />
        {t("preview.openExternal")}
      </button>
      <button
        className="context-menu-item danger"
        disabled={deleteDisabled}
        onClick={() => {
          onDelete();
          onClose();
        }}
        role="menuitem"
        type="button"
      >
        <Trash2 size={15} />
        {t("action.delete")}
      </button>
    </div>
  );
}
