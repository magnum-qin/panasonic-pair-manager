import {
  CheckSquare,
  FolderPlus,
  Image,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Search,
  SquareCheckBig,
  Trash2,
  Video,
} from "lucide-react";
import { IconButton } from "../../components/IconButton";
import { ToolbarButton } from "../../components/ToolbarButton";
import type { TranslationKey } from "../../i18n";
import type { MediaKindFilter } from "../../types";

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
          <div className="media-switch" role="group" aria-label={t("media.kind")}>
            <button
              aria-pressed={mediaKind === "photos"}
              className={mediaKind === "photos" ? "active" : ""}
              onClick={() => onSwitchMediaKind("photos")}
              type="button"
            >
              <Image size={16} /> {t("media.photos")}
            </button>
            <button
              aria-pressed={mediaKind === "videos"}
              className={mediaKind === "videos" ? "active" : ""}
              onClick={() => onSwitchMediaKind("videos")}
              type="button"
            >
              <Video size={16} /> {t("media.videos")}
            </button>
          </div>
          <ToolbarButton disabled={scanning || deleting || !rootIsAvailable} onClick={onRescan}>
            <RefreshCw size={17} /> {t("action.rescan")}
          </ToolbarButton>
          <ToolbarButton
            active={selectionMode}
            disabled={deleting || !visibleGroupCount}
            onClick={onToggleSelectionMode}
          >
            <SquareCheckBig size={17} />
            {selectionMode
              ? t("common.selected", { count: selectedCount })
              : t("action.multiSelect")}
          </ToolbarButton>
          {selectionMode && (
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
          )}
        </>
      )}
      {!hasSource && (
        <ToolbarButton disabled={deleting} onClick={onChooseFolder}>
          <FolderPlus size={17} /> {t("action.chooseFolder")}
        </ToolbarButton>
      )}
      <div className="toolbar-spacer" />
      {hasSource && (
        <>
          <label className="searchbox">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={t("search.placeholder")}
            />
          </label>
          <IconButton
            ariaExpanded={!inspectorCollapsed}
            label={inspectorCollapsed ? t("common.info") : t("action.close")}
            onClick={onToggleInspector}
          >
            {inspectorCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
          </IconButton>
        </>
      )}
    </div>
  );
}
