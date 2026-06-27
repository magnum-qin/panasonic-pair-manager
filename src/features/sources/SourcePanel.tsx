import type { TranslationKey } from "../../i18n";
import type { DriveCandidate, GroupKindFilter, MediaKindFilter, ScanSummary } from "../../types";
import { CurrentSourceFallback } from "./CurrentSourceFallback";
import { FixedSourceList } from "./FixedSourceList";
import { RemovableSourceList } from "./RemovableSourceList";
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
  const showCurrentSource =
    rootPath &&
    !manualRootSet.has(rootPath) &&
    !detectedRoots.some((drive) => drive.scanPath === rootPath);

  return (
    <aside className="sidebar">
      <section className="sidebar-module sources-module">
        <div className="source-group">
          <FixedSourceList
            deleting={deleting}
            manualAvailability={manualAvailability}
            manualRoots={manualRoots}
            rootPath={rootPath}
            t={t}
            onAddFolder={onAddFolder}
            onClearManualRoot={onClearManualRoot}
            onSelectManualRoot={onSelectManualRoot}
          />

          <RemovableSourceList
            deleting={deleting}
            detectedRoots={detectedRoots}
            rootPath={rootPath}
            t={t}
            onRefreshRemovableRoots={onRefreshRemovableRoots}
            onSelectRemovableRoot={onSelectRemovableRoot}
          />

          {showCurrentSource ? (
            <CurrentSourceFallback
              deleting={deleting}
              rootPath={rootPath}
              scanPending={scanPending}
              t={t}
              onSelectCurrentSource={onSelectCurrentSource}
            />
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
