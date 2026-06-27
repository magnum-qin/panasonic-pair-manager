import { SummaryRow } from "../../components/Summary";
import type { TranslationKey } from "../../i18n";
import type { MediaKindFilter, PhotoGroupDetail, PhotoGroupMetadata } from "../../types";
import { formatBytes } from "../../utils";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function InspectorInfoPanel({
  detail,
  mediaKind,
  metadata,
  metadataFetching,
  onOpenFile,
  t,
}: {
  detail: PhotoGroupDetail;
  mediaKind: MediaKindFilter;
  metadata?: PhotoGroupMetadata;
  metadataFetching: boolean;
  onOpenFile: (path: string) => void;
  t: Translator;
}) {
  return (
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
                metadata?.duration ??
                (metadataFetching ? t("metadata.reading") : t("metadata.unknown"))
              }
            />
            <SummaryRow
              label={t("common.codec")}
              value={
                metadata?.videoCodec ??
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
  );
}
