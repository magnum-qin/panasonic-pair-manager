import { FolderPlus } from "lucide-react";
import { IconButton } from "../../components/IconButton";
import { SidebarItem } from "../../components/SidebarItem";
import type { TranslationKey } from "../../i18n";
import { fileName } from "../../utils";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function FixedSourceList({
  deleting,
  manualAvailability,
  manualRoots,
  rootPath,
  t,
  onAddFolder,
  onClearManualRoot,
  onSelectManualRoot,
}: {
  deleting: boolean;
  manualAvailability: Map<string, boolean | undefined>;
  manualRoots: string[];
  rootPath: string;
  t: Translator;
  onAddFolder: () => void;
  onClearManualRoot: (path: string) => void;
  onSelectManualRoot: (path: string) => void;
}) {
  return (
    <div className="source-section">
      <div className="source-group-header">
        <span>{t("source.fixedFolders")}</span>
        <IconButton disabled={deleting} label={t("source.addFolder")} onClick={onAddFolder}>
          <FolderPlus size={15} />
        </IconButton>
      </div>
      {manualRoots.length ? (
        manualRoots.map((path) => (
          <SidebarItem
            active={rootPath === path}
            disabled={deleting}
            key={path}
            label={fileName(path) || path}
            onClear={() => onClearManualRoot(path)}
            onClick={() => onSelectManualRoot(path)}
            removeLabel={t("source.removeFolder")}
            subtitle={
              manualAvailability.get(path) === false ? `${path} - ${t("source.unavailable")}` : path
            }
            tone={manualAvailability.get(path) === false ? "offline" : undefined}
          />
        ))
      ) : (
        <div className="empty-note compact">{t("source.fixedEmpty")}</div>
      )}
    </div>
  );
}
