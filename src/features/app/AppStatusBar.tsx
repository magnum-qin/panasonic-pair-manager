import { CheckCircle2, Info, Settings } from "lucide-react";
import type { TranslationKey } from "../../i18n";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function AppStatusBar({
  onOpenAbout,
  onOpenSettings,
  statusMessage,
  t,
}: {
  onOpenAbout: () => void;
  onOpenSettings: () => void;
  statusMessage: string;
  t: Translator;
}) {
  return (
    <footer className="statusbar">
      <div className="status-message">
        <CheckCircle2 size={16} />
        <span>{statusMessage}</span>
      </div>
      <div className="status-actions">
        <button className="status-info" aria-label={t("common.info")} onClick={onOpenAbout}>
          <Info size={15} />
        </button>
        <button className="status-info" aria-label={t("setting.open")} onClick={onOpenSettings}>
          <Settings size={15} />
        </button>
      </div>
    </footer>
  );
}
