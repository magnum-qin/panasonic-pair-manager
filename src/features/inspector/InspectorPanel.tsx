import type { TranslationKey } from "../../i18n";
import type { MediaKindFilter, PhotoGroupDetail, PhotoGroupMetadata } from "../../types";
import { InspectorEmptyState } from "./InspectorEmptyState";
import { InspectorInfoPanel } from "./InspectorInfoPanel";
import { InspectorSkeleton, MetadataPanel } from "./MetadataPanel";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function InspectorPanel({
  activeId,
  detail,
  detailFetching,
  inspectorTab,
  mediaKind,
  mediaTransitioning,
  metadata,
  metadataFetching,
  onOpenFile,
  onTabChange,
  t,
}: {
  activeId: string;
  detail?: PhotoGroupDetail;
  detailFetching: boolean;
  inspectorTab: "info" | "metadata";
  mediaKind: MediaKindFilter;
  mediaTransitioning: boolean;
  metadata?: PhotoGroupMetadata;
  metadataFetching: boolean;
  onOpenFile: (path: string) => void;
  onTabChange: (tab: "info" | "metadata") => void;
  t: Translator;
}) {
  return (
    <aside className="inspector">
      <div className="tabs">
        <button
          className={inspectorTab === "info" ? "active" : ""}
          onClick={() => onTabChange("info")}
        >
          {t("common.info")}
        </button>
        <button
          className={inspectorTab === "metadata" ? "active" : ""}
          onClick={() => onTabChange("metadata")}
          disabled={!activeId}
        >
          {t("common.metadata")}
        </button>
      </div>
      <div className={`inspector-content ${mediaTransitioning ? "media-transitioning" : ""}`}>
        {detailFetching ? (
          <InspectorSkeleton />
        ) : detail && inspectorTab === "info" ? (
          <InspectorInfoPanel
            detail={detail}
            mediaKind={mediaKind}
            metadata={metadata}
            metadataFetching={metadataFetching}
            onOpenFile={onOpenFile}
            t={t}
          />
        ) : detail && inspectorTab === "metadata" ? (
          <MetadataPanel
            error={metadata?.error}
            isLoading={metadataFetching}
            metadata={metadata}
            t={t}
          />
        ) : (
          <InspectorEmptyState mediaKind={mediaKind} t={t} />
        )}
      </div>
    </aside>
  );
}
