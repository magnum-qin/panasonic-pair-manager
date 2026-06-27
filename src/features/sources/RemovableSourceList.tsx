import { RefreshCw } from "lucide-react";
import { IconButton } from "../../components/IconButton";
import { SidebarItem } from "../../components/SidebarItem";
import type { TranslationKey } from "../../i18n";
import type { DriveCandidate } from "../../types";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function RemovableSourceList({
  deleting,
  detectedRoots,
  rootPath,
  t,
  onRefreshRemovableRoots,
  onSelectRemovableRoot,
}: {
  deleting: boolean;
  detectedRoots: DriveCandidate[];
  rootPath: string;
  t: Translator;
  onRefreshRemovableRoots: () => void;
  onSelectRemovableRoot: (drive: DriveCandidate) => void;
}) {
  return (
    <div className="source-section">
      <div className="source-group-header">
        <span>{t("source.removableDevices")}</span>
        <IconButton disabled={false} label={t("source.refresh")} onClick={onRefreshRemovableRoots}>
          <RefreshCw size={14} />
        </IconButton>
      </div>
      {detectedRoots.length ? (
        detectedRoots.map((drive) => (
          <SidebarItem
            active={rootPath === drive.scanPath}
            disabled={deleting}
            key={drive.scanPath}
            label={drive.displayName}
            onClick={() => onSelectRemovableRoot(drive)}
            subtitle={drive.scanPath}
          />
        ))
      ) : (
        <div className="empty-note">{t("source.empty")}</div>
      )}
    </div>
  );
}
