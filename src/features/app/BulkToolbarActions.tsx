import { CheckSquare, RefreshCw, SquareCheckBig, Trash2 } from "lucide-react";
import { ToolbarButton } from "../../components/ToolbarButton";
import type { TranslationKey } from "../../i18n";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function BulkToolbarActions({
  deleting,
  rootIsAvailable,
  scanning,
  selectedCount,
  selectionMode,
  t,
  visibleGroupCount,
  onDeleteSelected,
  onRescan,
  onSelectAll,
  onToggleSelectionMode,
}: {
  deleting: boolean;
  rootIsAvailable: boolean;
  scanning: boolean;
  selectedCount: number;
  selectionMode: boolean;
  t: Translator;
  visibleGroupCount: number;
  onDeleteSelected: () => void;
  onRescan: () => void;
  onSelectAll: () => void;
  onToggleSelectionMode: () => void;
}) {
  return (
    <>
      <ToolbarButton disabled={scanning || deleting || !rootIsAvailable} onClick={onRescan}>
        <RefreshCw size={17} /> {t("action.rescan")}
      </ToolbarButton>
      <ToolbarButton
        active={selectionMode}
        disabled={deleting || !visibleGroupCount}
        onClick={onToggleSelectionMode}
      >
        <SquareCheckBig size={17} />
        {selectionMode ? t("common.selected", { count: selectedCount }) : t("action.multiSelect")}
      </ToolbarButton>
      {selectionMode ? (
        <>
          <ToolbarButton disabled={deleting || !visibleGroupCount} onClick={onSelectAll}>
            <CheckSquare size={17} /> {t("action.selectAll")}
          </ToolbarButton>
          <ToolbarButton
            disabled={deleting || !selectedCount}
            onClick={onDeleteSelected}
            variant="danger"
          >
            <Trash2 size={17} /> {t("action.deleteSelected")}
          </ToolbarButton>
        </>
      ) : null}
    </>
  );
}
