import { PanelRightClose, PanelRightOpen, Search } from "lucide-react";
import { IconButton } from "../../components/IconButton";
import type { TranslationKey } from "../../i18n";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function ToolbarSearchActions({
  inspectorCollapsed,
  query,
  t,
  onQueryChange,
  onToggleInspector,
}: {
  inspectorCollapsed: boolean;
  query: string;
  t: Translator;
  onQueryChange: (value: string) => void;
  onToggleInspector: () => void;
}) {
  return (
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
  );
}
