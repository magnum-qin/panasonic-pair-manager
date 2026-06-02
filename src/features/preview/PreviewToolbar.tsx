import { ExternalLink } from "lucide-react";
import { Button } from "../../components/Button";
import type { TranslationKey } from "../../i18n";
import { formatBytes } from "../../utils";
import type { PhotoGroupDetail } from "../../types";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function PreviewToolbar({
  externalPath,
  group,
  message,
  onOpenExternal,
  t,
}: {
  externalPath: string;
  group?: PhotoGroupDetail;
  message: string;
  onOpenExternal: () => void;
  t: Translator;
}) {
  return (
    <header className="preview-toolbar">
      <div className="preview-title" title={group?.stem ?? ""}>
        <strong>{group?.stem ?? t("preview.title")}</strong>
        <span>
          {group ? `${group.folderName} - ${formatBytes(group.totalSize)}` : t("preview.loading")}
        </span>
      </div>
      <div
        className="preview-actions"
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {message ? <span className="preview-action-message">{message}</span> : null}
        <Button disabled={!externalPath} onClick={onOpenExternal}>
          <ExternalLink size={15} />
          {t("preview.openExternal")}
        </Button>
      </div>
    </header>
  );
}
