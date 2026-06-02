import { SummaryRow } from "../../components/Summary";
import type { TranslationKey } from "../../i18n";
import type { PhotoGroupMetadata } from "../../types";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function MetadataPanel({
  error,
  isLoading,
  metadata,
  t,
}: {
  error?: string;
  isLoading: boolean;
  metadata?: PhotoGroupMetadata;
  t: Translator;
}) {
  if (isLoading && !metadata) {
    return <MetadataSkeleton />;
  }

  if (error && !metadata?.available) {
    return (
      <section>
        <div className="section-heading">
          <span>{t("common.metadata")}</span>
        </div>
        <div className="metadata-error">
          <strong>{t("metadata.errorTitle")}</strong>
          <p>{error}</p>
          <span>{t("metadata.errorDetail")}</span>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="kv">
        <SummaryRow
          label={t("common.captureTime")}
          value={metadata?.captureTime ?? t("metadata.unknown")}
        />
        <SummaryRow
          label={t("common.camera")}
          value={metadata?.cameraModel ?? t("metadata.unknown")}
        />
        <SummaryRow label={t("common.lens")} value={metadata?.lens ?? t("metadata.unknown")} />
        <SummaryRow
          label={t("common.dimensions")}
          value={
            metadata?.width && metadata.height
              ? `${metadata.width} x ${metadata.height}`
              : t("metadata.unknown")
          }
        />
      </section>
      <section>
        <div className="section-heading">
          <span>{t("metadata.source")}</span>
        </div>
        <div className="paths">
          <p>{metadata?.sourcePath ?? t("metadata.sourceEmpty")}</p>
        </div>
      </section>
      <section>
        <div className="section-heading">
          <span>{t("metadata.all")}</span>
          <span>{t("metadata.fields", { count: metadata?.items.length ?? 0 })}</span>
        </div>
        {metadata?.items.length ? (
          <div className="metadata-list">
            {metadata.items.map((item) => (
              <div className="metadata-row" key={`${item.tag}-${item.value}`}>
                <span>{item.tag}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-note">{t("empty.noExif")}</div>
        )}
      </section>
    </>
  );
}

export function InspectorSkeleton() {
  return (
    <div className="inspector-skeleton" aria-live="polite">
      <div className="skeleton-block skeleton-title" />
      <div className="skeleton-card" />
      <div className="skeleton-card" />
      <div className="skeleton-lines">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function MetadataSkeleton() {
  return (
    <div className="inspector-skeleton" aria-live="polite">
      <div className="skeleton-block skeleton-title" />
      <div className="skeleton-lines">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
