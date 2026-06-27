import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { Settings } from "lucide-react";
import { AccessibleModal } from "../../components/AccessibleModal";
import { Button } from "../../components/Button";
import {
  LANGUAGE_OPTIONS,
  normalizeLanguage,
  type LanguageCode,
  type TranslationKey,
} from "../../i18n";
import { THEME_OPTIONS, normalizeTheme, type ThemeCode } from "../../theme-options";
import type { ThumbnailCacheStats } from "../../types";
import { formatBytes } from "../../utils";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function SettingsModal({
  cacheStats,
  clearingCache,
  closing,
  language,
  onClearCache,
  onClose,
  onLanguageChange,
  onThemeChange,
  t,
  theme,
}: {
  cacheStats?: ThumbnailCacheStats;
  clearingCache: boolean;
  closing: boolean;
  language: LanguageCode;
  onClearCache: () => void;
  onClose: () => void;
  onLanguageChange: (language: LanguageCode) => void;
  onThemeChange: (theme: ThemeCode) => void;
  t: Translator;
  theme: ThemeCode;
}) {
  return (
    <AccessibleModal
      className="settings-modal"
      closing={closing}
      onClose={onClose}
      title={t("setting.title")}
    >
      <header>
        <Settings size={20} />
        <h2>{t("setting.title")}</h2>
      </header>
      <div className="settings-list">
        <label className="setting-row">
          <span>{t("setting.theme")}</span>
          <Select
            className="setting-select"
            MenuProps={{
              classes: { paper: "setting-select-menu" },
            }}
            size="small"
            value={theme}
            onChange={(event) => onThemeChange(normalizeTheme(event.target.value))}
          >
            {THEME_OPTIONS.map((option) => (
              <MenuItem key={option.code} value={option.code}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </label>
        <label className="setting-row">
          <span>{t("setting.language")}</span>
          <Select
            className="setting-select"
            MenuProps={{
              classes: { paper: "setting-select-menu" },
            }}
            size="small"
            value={language}
            onChange={(event) => onLanguageChange(normalizeLanguage(event.target.value))}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <MenuItem key={option.code} value={option.code}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </label>
        <div className="setting-row">
          <span>{t("setting.thumbnailCache")}</span>
          <div className="setting-inline">
            <strong>
              {formatBytes(cacheStats?.bytes ?? 0)}
              {" / "}
              {t("setting.cacheFiles", { count: cacheStats?.files ?? 0 })}
            </strong>
            <Button disabled={clearingCache} onClick={onClearCache}>
              {t("setting.clearCache")}
            </Button>
          </div>
        </div>
      </div>
      <div className="modal-actions">
        <Button onClick={onClose}>{t("action.close")}</Button>
      </div>
    </AccessibleModal>
  );
}
