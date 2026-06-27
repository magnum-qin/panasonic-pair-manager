import { Images, Video } from "lucide-react";
import type { TranslationKey } from "../../i18n";
import type { MediaKindFilter } from "../../types";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function InspectorEmptyState({
  mediaKind,
  t,
}: {
  mediaKind: MediaKindFilter;
  t: Translator;
}) {
  return (
    <div className="inspector-empty">
      {mediaKind === "videos" ? <Video size={42} /> : <Images size={42} />}
      <strong>
        {mediaKind === "videos" ? t("empty.inspectorVideoTitle") : t("empty.inspectorTitle")}
      </strong>
      <span>{mediaKind === "videos" ? t("empty.inspectorVideo") : t("empty.inspector")}</span>
    </div>
  );
}
