import { FileText, Image, Layers, Link2, Video } from "lucide-react";
import { SummaryButton } from "../../components/Summary";
import type { TranslationKey } from "../../i18n";
import type { GroupKindFilter, MediaKindFilter, ScanSummary } from "../../types";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function ScanSummaryPanel({
  currentSummary,
  groupKind,
  hasSource,
  mediaKind,
  mediaTransitioning,
  t,
  visibleGroupCount,
  onApplyKindFilter,
}: {
  currentSummary?: ScanSummary | null;
  groupKind: GroupKindFilter;
  hasSource: boolean;
  mediaKind: MediaKindFilter;
  mediaTransitioning: boolean;
  t: Translator;
  visibleGroupCount: number;
  onApplyKindFilter: (kind: GroupKindFilter) => void;
}) {
  return (
    <section
      className={`sidebar-module scan-summary ${mediaTransitioning ? "media-transitioning" : ""}`}
    >
      <div className="section-heading">
        <span>{t("summary.scan")}</span>
      </div>
      <SummaryButton
        active={groupKind === "all"}
        icon={mediaKind === "videos" ? <Video size={15} /> : <Layers size={15} />}
        label={mediaKind === "videos" ? t("media.videos") : t("common.groups")}
        onClick={() => onApplyKindFilter("all")}
        value={
          hasSource
            ? mediaKind === "videos"
              ? (currentSummary?.videoFiles ?? visibleGroupCount)
              : (currentSummary?.groups ?? visibleGroupCount)
            : 0
        }
      />
      {mediaKind === "photos" && (
        <>
          <SummaryButton
            active={groupKind === "paired"}
            icon={<Link2 size={15} />}
            label={t("filter.paired")}
            onClick={() => onApplyKindFilter("paired")}
            value={hasSource ? (currentSummary?.pairedGroups ?? 0) : 0}
          />
          <SummaryButton
            active={groupKind === "rawOnly"}
            icon={<FileText size={15} />}
            label={t("filter.rawOnly")}
            onClick={() => onApplyKindFilter("rawOnly")}
            value={hasSource ? (currentSummary?.rawOnlyGroups ?? 0) : 0}
          />
          <SummaryButton
            active={groupKind === "jpgOnly"}
            icon={<Image size={15} />}
            label={t("filter.jpgOnly")}
            onClick={() => onApplyKindFilter("jpgOnly")}
            value={hasSource ? (currentSummary?.jpgOnlyGroups ?? 0) : 0}
          />
        </>
      )}
    </section>
  );
}
