import { Image, Video } from "lucide-react";
import type { TranslationKey } from "../../i18n";
import type { MediaKindFilter } from "../../types";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function MediaSwitch({
  mediaKind,
  onSwitchMediaKind,
  t,
}: {
  mediaKind: MediaKindFilter;
  onSwitchMediaKind: (kind: MediaKindFilter) => void;
  t: Translator;
}) {
  return (
    <div className="media-switch" role="group" aria-label={t("media.kind")}>
      <button
        aria-pressed={mediaKind === "photos"}
        className={mediaKind === "photos" ? "active" : ""}
        onClick={() => onSwitchMediaKind("photos")}
        type="button"
      >
        <Image size={16} /> {t("media.photos")}
      </button>
      <button
        aria-pressed={mediaKind === "videos"}
        className={mediaKind === "videos" ? "active" : ""}
        onClick={() => onSwitchMediaKind("videos")}
        type="button"
      >
        <Video size={16} /> {t("media.videos")}
      </button>
    </div>
  );
}
