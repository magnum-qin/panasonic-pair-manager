import { Trash2 } from "lucide-react";
import { AccessibleModal } from "../../components/AccessibleModal";
import { Button } from "../../components/Button";
import { SummaryRow } from "../../components/Summary";
import type { TranslationKey } from "../../i18n";
import type { PhotoFile } from "../../types";
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
