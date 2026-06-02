import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { Info, Settings, Trash2 } from "lucide-react";
import { AccessibleModal } from "../../components/AccessibleModal";
import { Button } from "../../components/Button";
import { SummaryRow } from "../../components/Summary";
import {
  LANGUAGE_OPTIONS,
  normalizeLanguage,
  type LanguageCode,
  type TranslationKey,
} from "../../i18n";
import { THEME_OPTIONS, normalizeTheme, type ThemeCode } from "../../theme-options";
import type { PhotoFile, ThumbnailCacheStats } from "../../types";
import { formatBytes } from "../../utils";
import { DELETE_FILE_PREVIEW_LIMIT } from "./app-config";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export interface DeletePlan {
  groups: number;
  files: number;
  rawFiles: number;
  jpgFiles: number;
  videoFiles: number;
  sidecarFiles: number;
  totalSize: number;
}

export function AboutModal({
  closing,
  onClose,
  t,
}: {
  closing: boolean;
  onClose: () => void;
  t: Translator;
}) {
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
      </div>
      <div className="modal-actions">
        <Button onClick={onClose}>{t("action.close")}</Button>
      </div>
    </AccessibleModal>
  );
}

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

export function DeleteModal({
  deleting,
  detailLoading,
  files,
  onClose,
  onConfirm,
  onOpenContainingFolder,
  plan,
  closing,
  t,
}: {
  deleting: boolean;
  detailLoading: boolean;
  files: PhotoFile[];
  onClose: () => void;
  onConfirm: () => void;
  onOpenContainingFolder: () => void;
  plan: DeletePlan;
  closing: boolean;
  t: Translator;
}) {
  return (
    <AccessibleModal
      closeOnBackdrop={false}
      closing={closing}
      onClose={onClose}
      title={t("delete.title")}
    >
      <header>
        <Trash2 size={20} />
        <h2>{t("delete.title")}</h2>
      </header>
      <p>{t("delete.confirmDescription")}</p>
      <div className="delete-stats">
        <SummaryRow label={t("common.groups")} value={plan.groups} />
        <SummaryRow label={t("common.files")} value={plan.files} />
        <SummaryRow label={t("delete.rawFiles")} value={plan.rawFiles} />
        <SummaryRow label={t("delete.jpgFiles")} value={plan.jpgFiles} />
        <SummaryRow label={t("delete.videoFiles")} value={plan.videoFiles} />
        <SummaryRow label={t("delete.sidecarFiles")} value={plan.sidecarFiles} />
        <SummaryRow label={t("common.totalSize")} value={formatBytes(plan.totalSize)} />
      </div>
      <div className="delete-file-preview">
        <div className="section-heading">
          <span>{t("delete.filePreview")}</span>
          {detailLoading ? <span>{t("delete.loadingFiles")}</span> : null}
        </div>
        {files.length ? (
          <div className="delete-file-list">
            {files.slice(0, DELETE_FILE_PREVIEW_LIMIT).map((file) => (
              <div className="delete-file-row" key={file.id} title={file.path}>
                <strong>{file.fileName}</strong>
                <span>{file.kind.toUpperCase()}</span>
                <em>{formatBytes(file.size)}</em>
              </div>
            ))}
            {files.length > DELETE_FILE_PREVIEW_LIMIT ? (
              <div className="delete-file-more">
                {t("delete.moreFiles", {
                  count: files.length - DELETE_FILE_PREVIEW_LIMIT,
                })}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="empty-note compact">
            {detailLoading ? t("delete.loadingFiles") : t("delete.noFiles")}
          </div>
        )}
      </div>
      <label className="recycle-check">
        <input type="checkbox" checked readOnly />
        {t("delete.moveToRecycle")}
      </label>
      <div className="modal-actions">
        <Button disabled={deleting || !files.length} onClick={onOpenContainingFolder}>
          {t("delete.openContainingFolder")}
        </Button>
        <Button disabled={deleting} onClick={onConfirm} variant="solidDanger">
          {t("action.delete")}
        </Button>
        <Button disabled={deleting} onClick={onClose}>
          {t("action.cancel")}
        </Button>
      </div>
    </AccessibleModal>
  );
}
