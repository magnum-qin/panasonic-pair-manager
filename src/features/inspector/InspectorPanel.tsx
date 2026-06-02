import { Images, Video } from "lucide-react";
import { SummaryRow } from "../../components/Summary";
import type { TranslationKey } from "../../i18n";
import type { MediaKindFilter, PhotoGroupDetail, PhotoGroupMetadata } from "../../types";
import { formatBytes } from "../../utils";
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
          <>
            <section>
              <div className="section-heading">
                <span>{t("common.files")}</span>
                <span>{t("common.selected", { count: detail.files.length })}</span>
              </div>
              <div className="file-list">
                {detail.files.map((file) => (
                  <button
                    className="file-row"
                    key={file.id}
                    onClick={() => onOpenFile(file.path)}
                    title={file.path}
                  >
                    <strong>{file.fileName}</strong>
                    <span>{file.kind.toUpperCase()}</span>
                    <em>{formatBytes(file.size)}</em>
                  </button>
                ))}
              </div>
            </section>
            <section className="kv">
              <SummaryRow
                label={t("common.captureTime")}
                value={
                  metadata?.captureTime ??
                  detail.captureTime ??
                  (metadataFetching ? t("metadata.reading") : t("metadata.unknown"))
                }
              />
              <SummaryRow
                label={t("common.camera")}
                value={
                  metadata?.cameraModel ??
                  detail.cameraModel ??
                  (metadataFetching ? t("metadata.reading") : t("metadata.unknown"))
                }
              />
              {mediaKind === "videos" ? (
                <>
                  <SummaryRow
                    label={t("common.dimensions")}
                    value={
                      metadata?.width && metadata.height
                        ? `${metadata.width} x ${metadata.height}`
                        : metadataFetching
                          ? t("metadata.reading")
                          : t("metadata.unknown")
                    }
                  />
                  <SummaryRow
                    label={t("common.duration")}
                    value={
                      metadataValue(metadata, "Duration") ??
                      (metadataFetching ? t("metadata.reading") : t("metadata.unknown"))
                    }
                  />
                </>
              ) : (
                <SummaryRow
                  label={t("common.lens")}
                  value={
                    metadata?.lens ??
                    detail.lens ??
                    (metadataFetching ? t("metadata.reading") : t("metadata.unknown"))
                  }
                />
              )}
              <SummaryRow label={t("common.folder")} value={detail.folderName} />
              <SummaryRow label={t("common.totalSize")} value={formatBytes(detail.totalSize)} />
            </section>
            <section>
              <div className="section-heading">
                <span>{t("common.path")}</span>
              </div>
              <div className="paths">
                {detail.files.map((file) => (
                  <p key={file.id}>{file.path}</p>
                ))}
              </div>
            </section>
          </>
        ) : detail && inspectorTab === "metadata" ? (
          <MetadataPanel
            error={metadata?.error}
            isLoading={metadataFetching}
            metadata={metadata}
            t={t}
          />
        ) : (
          <div className="inspector-empty">
            {mediaKind === "videos" ? <Video size={42} /> : <Images size={42} />}
            <strong>
              {mediaKind === "videos" ? t("empty.inspectorVideoTitle") : t("empty.inspectorTitle")}
            </strong>
            <span>{mediaKind === "videos" ? t("empty.inspectorVideo") : t("empty.inspector")}</span>
          </div>
        )}
      </div>
    </aside>
  );
}

function metadataValue(metadata: PhotoGroupMetadata | undefined, tag: string) {
  const normalizedTag = tag.toLowerCase();
  return metadata?.items.find((item) => item.tag.toLowerCase() === normalizedTag)?.value;
}
