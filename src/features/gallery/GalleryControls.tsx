import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import type { TranslationKey } from "../../i18n";
import type { PhotoSortMode } from "../../types";
import { CARD_SIZE_PRESETS, PHOTO_SORT_OPTIONS, type CardSizePreset } from "../app/app-config";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function GalleryControls({
  cardSize,
  hasSource,
  photoSort,
  t,
  onCardSizeChange,
  onSortChange,
}: {
  cardSize: CardSizePreset;
  hasSource: boolean;
  photoSort: PhotoSortMode;
  t: Translator;
  onCardSizeChange: (value: CardSizePreset) => void;
  onSortChange: (value: PhotoSortMode) => void;
}) {
  return (
    <>
      <label className="sort-control">
        <span>{t("sort.label")}</span>
        <Select
          className="toolbar-select"
          disabled={!hasSource}
          MenuProps={{
            classes: { paper: "setting-select-menu" },
          }}
          size="small"
          value={photoSort}
          onChange={(event) => onSortChange(event.target.value as PhotoSortMode)}
        >
          {PHOTO_SORT_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {t(option.labelKey)}
            </MenuItem>
          ))}
        </Select>
      </label>
      <div className="size-control" aria-label={t("size.card")} title={t("size.card")}>
        <span>{t("size.card")}</span>
        <div className="size-options" role="group" aria-label={t("size.presets")}>
          {CARD_SIZE_PRESETS.map((preset) => (
            <button
              aria-pressed={cardSize === preset.value}
              className={cardSize === preset.value ? "active" : ""}
              key={preset.value}
              onClick={() => onCardSizeChange(preset.value)}
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
