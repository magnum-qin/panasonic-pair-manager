import { FolderPlus, RefreshCw } from "lucide-react";
import { IconButton } from "../../components/IconButton";
import { SidebarItem } from "../../components/SidebarItem";
import type { TranslationKey } from "../../i18n";
import type { DriveCandidate, GroupKindFilter, MediaKindFilter, ScanSummary } from "../../types";
import { fileName } from "../../utils";
import { ScanSummaryPanel } from "./ScanSummaryPanel";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function SourcePanel({
  currentSummary,
  deleting,
  detectedRoots,
  groupKind,
  hasSource,
  manualAvailability,
  manualRootSet,
  manualRoots,
  mediaKind,
  mediaTransitioning,
  rootPath,
  scanPending,
  t,
  visibleGroupCount,
  onAddFolder,
  onApplyKindFilter,
  onClearManualRoot,
  onRefreshRemovableRoots,
  onSelectCurrentSource,
  onSelectManualRoot,
  onSelectRemovableRoot,
}: {
  currentSummary?: ScanSummary | null;
  deleting: boolean;
  detectedRoots: DriveCandidate[];
  groupKind: GroupKindFilter;
  hasSource: boolean;
  manualAvailability: Map<string, boolean | undefined>;
  manualRootSet: Set<string>;
  manualRoots: string[];
  mediaKind: MediaKindFilter;
  mediaTransitioning: boolean;
  rootPath: string;
  scanPending: boolean;
  t: Translator;
  visibleGroupCount: number;
  onAddFolder: () => void;
  onApplyKindFilter: (kind: GroupKindFilter) => void;
  onClearManualRoot: (path: string) => void;
  onRefreshRemovableRoots: () => void;
  onSelectCurrentSource: () => void;
  onSelectManualRoot: (path: string) => void;
  onSelectRemovableRoot: (drive: DriveCandidate) => void;
}) {
  return (
    <aside className="sidebar">
      <section className="sidebar-module sources-module">
        <div className="source-group">
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
                    manualAvailability.get(path) === false
                      ? `${path} 路 ${t("source.unavailable")}`
                      : path
                  }
                  tone={manualAvailability.get(path) === false ? "offline" : undefined}
                />
              ))
            ) : (
              <div className="empty-note compact">{t("source.fixedEmpty")}</div>
            )}
          </div>

          <div className="source-section">
            <div className="source-group-header">
              <span>{t("source.removableDevices")}</span>
              <IconButton
                disabled={false}
                label={t("source.refresh")}
                onClick={onRefreshRemovableRoots}
              >
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

          {rootPath &&
          !manualRootSet.has(rootPath) &&
          !detectedRoots.some((drive) => drive.scanPath === rootPath) ? (
            <div className="source-section">
              <div className="source-group-header">
                <span>{t("source.currentSource")}</span>
              </div>
              <SidebarItem
                active
                disabled={deleting || scanPending}
                label={fileName(rootPath) || rootPath}
                onClick={onSelectCurrentSource}
                subtitle={rootPath}
              />
            </div>
          ) : null}
        </div>
      </section>

      <ScanSummaryPanel
        currentSummary={currentSummary}
        groupKind={groupKind}
        hasSource={hasSource}
        mediaKind={mediaKind}
        mediaTransitioning={mediaTransitioning}
        t={t}
        visibleGroupCount={visibleGroupCount}
        onApplyKindFilter={onApplyKindFilter}
      />
    </aside>
  );
}
