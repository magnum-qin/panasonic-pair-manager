import { useCallback, useEffect, useMemo, useState } from "react";
import { PHOTO_SORT_OPTIONS, type CardSizePreset } from "../features/app/app-config";
import { makeTranslator, nearestCardSizePreset } from "../features/app/app-utils";
import { normalizeLanguage, translate, type LanguageCode } from "../i18n";
import { normalizeTheme, type ThemeCode } from "../theme-options";
import type { PhotoSortMode } from "../types";

export function useAppPreferences() {
  const [language, setLanguage] = useState<LanguageCode>(() =>
    normalizeLanguage(window.localStorage.getItem("ppm.language")),
  );
  const [theme, setTheme] = useState<ThemeCode>(() =>
    normalizeTheme(window.localStorage.getItem("ppm.theme")),
  );
  const [photoSort, setPhotoSort] = useState<PhotoSortMode>(() => {
    const stored = window.localStorage.getItem("ppm.photoSort");
    return PHOTO_SORT_OPTIONS.some((option) => option.value === stored)
      ? (stored as PhotoSortMode)
      : "captureAsc";
  });
  const [cardSize, setCardSize] = useState(() => {
    const stored = Number(window.localStorage.getItem("ppm.cardSize"));
    return Number.isFinite(stored) ? nearestCardSizePreset(stored) : 230;
  });
  const t = useMemo(() => makeTranslator(language), [language]);
  const [message, setMessage] = useState(() => translate(language, "status.ready"));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("ppm.theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("ppm.language", language);
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem("ppm.photoSort", photoSort);
  }, [photoSort]);

  const updateCardSize = useCallback((value: CardSizePreset) => {
    const nextSize = nearestCardSizePreset(value);
    setCardSize(nextSize);
    window.localStorage.setItem("ppm.cardSize", String(nextSize));
  }, []);

  return {
    cardSize,
    language,
    message,
    photoSort,
    setLanguage,
    setMessage,
    setPhotoSort,
    setTheme,
    t,
    theme,
    updateCardSize,
  };
}
