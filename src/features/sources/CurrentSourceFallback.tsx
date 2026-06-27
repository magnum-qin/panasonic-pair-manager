import { SidebarItem } from "../../components/SidebarItem";
import type { TranslationKey } from "../../i18n";
import { fileName } from "../../utils";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function CurrentSourceFallback({
  deleting,
  rootPath,
  scanPending,
  t,
  onSelectCurrentSource,
}: {
  deleting: boolean;
  rootPath: string;
  scanPending: boolean;
  t: Translator;
  onSelectCurrentSource: () => void;
}) {
  return (
    <div className="source-section">
      <div className="source-group-header">
        <span>{t("source.currentSource")}</span>
      </div>
      <SidebarItem
        active
        disabled={deleting || scanPending}
        label={fileName(rootPath) || rootPath}
        onClick={onSelectCurrentSource}
        subtitle={rootPath}
      />
    </div>
  );
}
