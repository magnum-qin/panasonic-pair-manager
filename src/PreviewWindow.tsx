import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { openPhotoFile } from "./api";
import { PreviewStage } from "./features/preview/PreviewStage";
import { PreviewToolbar } from "./features/preview/PreviewToolbar";
import {
  PREVIEW_WINDOW_STORAGE_KEY,
  type PreviewWindowState,
} from "./features/preview/preview-types";
import { usePreviewData } from "./features/preview/usePreviewData";
import { usePreviewGestures } from "./features/preview/usePreviewGestures";
import { usePreviewNavigation } from "./features/preview/usePreviewNavigation";
import { normalizeLanguage, translate, type LanguageCode, type TranslationKey } from "./i18n";
import { normalizeTheme, type ThemeCode } from "./theme-options";

function makeTranslator(language: LanguageCode) {
  return (key: TranslationKey, values?: Record<string, string | number>) =>
    translate(language, key, values);
}

function loadPreviewWindowState(): PreviewWindowState {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PREVIEW_WINDOW_STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed.id !== "string") return { id: "", ids: [] };
    return {
      id: parsed.id,
      ids: Array.isArray(parsed.ids)
        ? parsed.ids.filter((id: unknown): id is string => typeof id === "string")
        : [],
    };
  } catch {
    return { id: "", ids: [] };
  }
}

export default function PreviewWindow() {
  const queryClient = useQueryClient();
  const [language] = useState<LanguageCode>(() =>
    normalizeLanguage(window.localStorage.getItem("ppm.language")),
  );
  const [theme] = useState<ThemeCode>(() =>
    normalizeTheme(window.localStorage.getItem("ppm.theme")),
  );
  const t = useMemo(() => makeTranslator(language), [language]);
  const currentWindow = useMemo(() => getCurrentWebviewWindow(), []);
  const [previewState, setPreviewState] = useState<PreviewWindowState>(loadPreviewWindowState);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const { canNavigate, currentId, currentIndex, movePreview } = usePreviewNavigation({
    previewState,
    setPreviewState,
  });
  const { detailQuery, externalPath, group, previewPath, previewQuery } = usePreviewData({
    canNavigate,
    currentId,
    currentIndex,
    ids: previewState.ids,
    queryClient,
  });
  const {
    handlePointerDown,
    handlePointerEnd,
    handlePointerMove,
    imageFrameRef,
    previewTransform,
  } = usePreviewGestures(previewPath);

  const openExternal = useCallback(async () => {
    if (!externalPath) return;
    setMessage("");
    try {
      await openPhotoFile(externalPath);
    } catch (error) {
      setMessage(String(error));
    }
  }, [externalPath]);

  useEffect(() => {
    setLoaded(false);
    setMessage("");
  }, [previewPath]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, [currentId]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    currentWindow.show();
    currentWindow.setFocus();
  }, [currentWindow]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<PreviewWindowState>("preview-window-state", (event) => {
      setPreviewState(event.payload);
    }).then((nextUnlisten) => {
      unlisten = nextUnlisten;
    });
    return () => unlisten?.();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
    }
    if (event.key === "ArrowLeft" && canNavigate) {
      event.preventDefault();
      movePreview(-1);
      return;
    }
    if (event.key === "ArrowRight" && canNavigate) {
      event.preventDefault();
      movePreview(1);
    }
  };

  return (
    <div className="preview-window-root">
      <div
        aria-label={t("preview.title")}
        aria-modal="true"
        className="preview-dialog preview-window-dialog"
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <PreviewToolbar
          externalPath={externalPath}
          group={group}
          message={message}
          onOpenExternal={openExternal}
          t={t}
        />

        <PreviewStage
          canNavigate={canNavigate}
          imageFrameRef={imageFrameRef}
          isFetching={detailQuery.isFetching || previewQuery.isFetching}
          loaded={loaded}
          onImageLoad={() => setLoaded(true)}
          onMove={movePreview}
          onPointerCancel={handlePointerEnd}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          previewPath={previewPath}
          previewTransform={previewTransform}
          t={t}
        />
      </div>
    </div>
  );
}
