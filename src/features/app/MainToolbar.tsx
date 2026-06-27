import { FolderPlus } from "lucide-react";
import { ToolbarButton } from "../../components/ToolbarButton";
import type { TranslationKey } from "../../i18n";
import type { MediaKindFilter } from "../../types";
import { BulkToolbarActions } from "./BulkToolbarActions";
import { MediaSwitch } from "./MediaSwitch";
import { ToolbarSearchActions } from "./ToolbarSearchActions";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function MainToolbar({
  deleting,
  hasSource,
  inspectorCollapsed,
  mediaKind,
  query,
  rootIsAvailable,
  scanning,
  selectedCount,
  selectionMode,
  t,
  visibleGroupCount,
  onChooseFolder,
  onDeleteSelected,
  onQueryChange,
  onRescan,
  onSelectAll,
  onSwitchMediaKind,
  onToggleInspector,
  onToggleSelectionMode,
}: {
  deleting: boolean;
  hasSource: boolean;
  inspectorCollapsed: boolean;
  mediaKind: MediaKindFilter;
  query: string;
  rootIsAvailable: boolean;
  scanning: boolean;
  selectedCount: number;
  selectionMode: boolean;
  t: Translator;
  visibleGroupCount: number;
  onChooseFolder: () => void;
  onDeleteSelected: () => void;
  onQueryChange: (value: string) => void;
  onRescan: () => void;
  onSelectAll: () => void;
  onSwitchMediaKind: (kind: MediaKindFilter) => void;
  onToggleInspector: () => void;
  onToggleSelectionMode: () => void;
}) {
  return (
    <div className="toolbar">
      {hasSource && (
        <>
          <MediaSwitch mediaKind={mediaKind} onSwitchMediaKind={onSwitchMediaKind} t={t} />
          <BulkToolbarActions
            deleting={deleting}
            rootIsAvailable={rootIsAvailable}
            scanning={scanning}
            selectedCount={selectedCount}
            selectionMode={selectionMode}
            t={t}
            visibleGroupCount={visibleGroupCount}
            onDeleteSelected={onDeleteSelected}
            onRescan={onRescan}
            onSelectAll={onSelectAll}
            onToggleSelectionMode={onToggleSelectionMode}
          />
        </>
      )}
      {!hasSource && (
        <ToolbarButton disabled={deleting} onClick={onChooseFolder}>
          <FolderPlus size={17} /> {t("action.chooseFolder")}
        </ToolbarButton>
      )}
      <div className="toolbar-spacer" />
      {hasSource && (
        <ToolbarSearchActions
          inspectorCollapsed={inspectorCollapsed}
          query={query}
          t={t}
          onQueryChange={onQueryChange}
          onToggleInspector={onToggleInspector}
        />
      )}
    </div>
  );
}
