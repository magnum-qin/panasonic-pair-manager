import { Info } from "lucide-react";
import { AccessibleModal } from "../../components/AccessibleModal";
import { Button } from "../../components/Button";
import { SummaryRow } from "../../components/Summary";
import type { TranslationKey } from "../../i18n";
import type { ExternalToolStatus } from "../../types";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function AboutModal({
  closing,
  onClose,
  t,
  toolStatus,
}: {
  closing: boolean;
  onClose: () => void;
  t: Translator;
  toolStatus?: ExternalToolStatus;
}) {
  const toolValue = (available: boolean | undefined) =>
    available === undefined
      ? t("metadata.reading")
      : available
        ? t("common.available")
        : t("source.unavailable");

  return (
    <AccessibleModal
      className="about-modal"
      closing={closing}
      onClose={onClose}
      title="Panasonic Pair Manager"
    >
      <header>
        <Info size={20} />
        <h2>Panasonic Pair Manager</h2>
      </header>
      <p>{t("about.description")}</p>
      <div className="about-list">
        <SummaryRow label="Stack" value={t("about.stack")} />
        <SummaryRow label="Preview" value={t("about.preview")} />
        <SummaryRow label="Delete" value={t("about.delete")} />
        <SummaryRow label="Metadata" value={t("about.metadata")} />
        <SummaryRow label="ExifTool" value={toolValue(toolStatus?.exiftoolAvailable)} />
        <SummaryRow label="FFmpeg" value={toolValue(toolStatus?.ffmpegAvailable)} />
      </div>
      <div className="modal-actions">
        <Button onClick={onClose}>{t("action.close")}</Button>
      </div>
    </AccessibleModal>
  );
}
