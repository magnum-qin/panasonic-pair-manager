import { useQuery, useQueryClient } from "@tanstack/react-query";
import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { getPhotoGroup, getPhotoThumbnail, openPhotoFile } from "./api";
import { PreviewStage } from "./features/preview/PreviewStage";
import { PreviewToolbar } from "./features/preview/PreviewToolbar";
import {
  PREVIEW_WINDOW_STORAGE_KEY,
  type PreviewWindowState,
} from "./features/preview/preview-types";
import { usePreviewGestures } from "./features/preview/usePreviewGestures";
import { usePreviewNavigation } from "./features/preview/usePreviewNavigation";
import { normalizeLanguage, translate, type LanguageCode, type TranslationKey } from "./i18n";
import { normalizeTheme, type ThemeCode } from "./theme-options";

function groupPreviewPath(group: Awaited<ReturnType<typeof getPhotoGroup>> | undefined) {
  return group?.files.find((file) => file.kind === "jpg")?.path ?? "";
}

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
  const detailQuery = useQuery({
    enabled: Boolean(currentId),
    queryFn: () => getPhotoGroup(currentId),
    queryKey: ["photo-group-detail", currentId],
  });
  const group = detailQuery.data;
  const jpgFile = group?.files.find((file) => file.kind === "jpg");
  const rawFile = group?.files.find((file) => file.kind === "raw");
  const previewQuery = useQuery({
    enabled: Boolean(currentId && !jpgFile),
    queryFn: () => getPhotoThumbnail(currentId, 2400),
    queryKey: ["photo-thumbnail", currentId, 2400],
    staleTime: Infinity,
  });
  const previewPath = jpgFile?.path ?? previewQuery.data;
  const externalPath = jpgFile?.path ?? rawFile?.path ?? previewPath ?? "";
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

  useEffect(() => {
    if (!canNavigate) return;
    const adjacent = [
      previewState.ids[(currentIndex - 1 + previewState.ids.length) % previewState.ids.length],
      previewState.ids[(currentIndex + 1) % previewState.ids.length],
    ];
    adjacent.forEach((id) => {
      queryClient.prefetchQuery({
        queryFn: async () => {
          const nextGroup = await getPhotoGroup(id);
          const nextPreviewPath = groupPreviewPath(nextGroup);
          if (nextPreviewPath) {
            const image = new window.Image();
            image.decoding = "async";
            image.src = convertFileSrc(nextPreviewPath);
          } else {
            queryClient.prefetchQuery({
              queryFn: () => getPhotoThumbnail(id, 2400),
              queryKey: ["photo-thumbnail", id, 2400],
              staleTime: Infinity,
            });
          }
          return nextGroup;
        },
        queryKey: ["photo-group-detail", id],
      });
    });
  }, [canNavigate, currentIndex, previewState.ids, queryClient]);

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
