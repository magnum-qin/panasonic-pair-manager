import { useQuery, useQueryClient } from "@tanstack/react-query";
import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import ButtonBase from "@mui/material/ButtonBase";
import { ChevronLeft, ChevronRight, ExternalLink, Image } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { getPhotoGroup, getPhotoThumbnail, openPhotoFile } from "./api";
import { Button } from "./components/Button";
import { normalizeLanguage, translate, type LanguageCode, type TranslationKey } from "./i18n";
import { normalizeTheme, type ThemeCode } from "./theme-options";
import { formatBytes } from "./utils";

const PREVIEW_WINDOW_STORAGE_KEY = "ppm.previewWindowState";
const MIN_PREVIEW_SCALE = 1;
const MAX_PREVIEW_SCALE = 6;
const PREVIEW_WHEEL_ZOOM_SENSITIVITY = 0.004;
const PREVIEW_PINCH_ZOOM_SENSITIVITY = 0.007;

interface PreviewWindowState {
  id: string;
  ids: string[];
}

interface PreviewTransform {
  scale: number;
  x: number;
  y: number;
}

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pointerDistance(points: { x: number; y: number }[]) {
  if (points.length < 2) return 0;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function pointerCenter(points: { x: number; y: number }[]) {
  if (!points.length) return { x: 0, y: 0 };
  const total = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), {
    x: 0,
    y: 0,
  });
  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
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
  const currentWebview = useMemo(() => getCurrentWebview(), []);
  const currentWindow = useMemo(() => getCurrentWebviewWindow(), []);
  const [previewState, setPreviewState] = useState<PreviewWindowState>(loadPreviewWindowState);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const imageFrameRef = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [previewTransform, setPreviewTransform] = useState<PreviewTransform>({
    scale: MIN_PREVIEW_SCALE,
    x: 0,
    y: 0,
  });
  const previewTransformRef = useRef(previewTransform);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const panGestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);
  const pinchGestureRef = useRef<{
    centerX: number;
    centerY: number;
    distance: number;
    scale: number;
    x: number;
    y: number;
  } | null>(null);
  const currentId = previewState.id;
  const currentIndex = currentId ? previewState.ids.indexOf(currentId) : -1;
  const canNavigate = previewState.ids.length > 1 && currentIndex >= 0;
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

  const updatePreviewTransform = useCallback(
    (updater: (current: PreviewTransform) => PreviewTransform) => {
      setPreviewTransform((current) => {
        const next = updater(current);
        const normalized =
          next.scale <= MIN_PREVIEW_SCALE ? { scale: MIN_PREVIEW_SCALE, x: 0, y: 0 } : next;
        previewTransformRef.current = normalized;
        return normalized;
      });
    },
    [],
  );

  const zoomPreview = useCallback(
    (deltaY: number, sensitivity = PREVIEW_WHEEL_ZOOM_SENSITIVITY) => {
      if (!previewPath) return;
      const scaleFactor = Math.exp(-deltaY * sensitivity);
      updatePreviewTransform((current) => ({
        ...current,
        scale: clamp(current.scale * scaleFactor, MIN_PREVIEW_SCALE, MAX_PREVIEW_SCALE),
      }));
    },
    [previewPath, updatePreviewTransform],
  );

  const setCurrentId = useCallback((id: string) => {
    setPreviewState((current) => {
      const next = { ...current, id };
      window.localStorage.setItem(PREVIEW_WINDOW_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const movePreview = useCallback(
    (direction: -1 | 1) => {
      if (!canNavigate) return;
      const nextIndex =
        (currentIndex + direction + previewState.ids.length) % previewState.ids.length;
      setCurrentId(previewState.ids[nextIndex]);
    },
    [canNavigate, currentIndex, previewState.ids, setCurrentId],
  );

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
    setPreviewTransform({ scale: MIN_PREVIEW_SCALE, x: 0, y: 0 });
    previewTransformRef.current = { scale: MIN_PREVIEW_SCALE, x: 0, y: 0 };
    pointersRef.current.clear();
    panGestureRef.current = null;
    pinchGestureRef.current = null;
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
    const frame = imageFrameRef.current;
    if (!frame) return;

    const handleNativeWheel = (event: WheelEvent) => {
      if (!previewPath) return;
      if (!(event.target instanceof Node) || !frame.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      zoomPreview(
        event.deltaY,
        event.ctrlKey ? PREVIEW_PINCH_ZOOM_SENSITIVITY : PREVIEW_WHEEL_ZOOM_SENSITIVITY,
      );
      if (event.ctrlKey) void currentWebview.setZoom(1);
    };

    window.addEventListener("wheel", handleNativeWheel, { capture: true, passive: false });
    return () => window.removeEventListener("wheel", handleNativeWheel, { capture: true });
  }, [currentWebview, previewPath, zoomPreview]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    let previousScale = viewport.scale || 1;
    const handleViewportZoom = () => {
      const nextScale = viewport.scale || 1;
      if (!previewPath || Math.abs(nextScale - previousScale) < 0.01) {
        previousScale = nextScale;
        return;
      }

      const syntheticDelta = nextScale > previousScale ? -42 : 42;
      zoomPreview(syntheticDelta);
      previousScale = nextScale;
      void currentWebview.setZoom(1);
    };

    viewport.addEventListener("resize", handleViewportZoom);
    return () => viewport.removeEventListener("resize", handleViewportZoom);
  }, [currentWebview, previewPath, zoomPreview]);

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

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!previewPath) return;
    if (event.pointerType === "mouse" && previewTransformRef.current.scale <= MIN_PREVIEW_SCALE)
      return;

    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const points = Array.from(pointersRef.current.values());
    if (points.length >= 2) {
      const current = previewTransformRef.current;
      const center = pointerCenter(points);
      pinchGestureRef.current = {
        centerX: center.x,
        centerY: center.y,
        distance: pointerDistance(points),
        scale: current.scale,
        x: current.x,
        y: current.y,
      };
      panGestureRef.current = null;
      return;
    }

    if (previewTransformRef.current.scale > MIN_PREVIEW_SCALE) {
      const current = previewTransformRef.current;
      panGestureRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        x: current.x,
        y: current.y,
      };
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;

    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = Array.from(pointersRef.current.values());

    if (points.length >= 2 && pinchGestureRef.current) {
      event.preventDefault();
      const nextDistance = pointerDistance(points);
      const nextCenter = pointerCenter(points);
      if (!nextDistance || !pinchGestureRef.current.distance) return;
      const nextScale = clamp(
        pinchGestureRef.current.scale * (nextDistance / pinchGestureRef.current.distance),
        MIN_PREVIEW_SCALE,
        MAX_PREVIEW_SCALE,
      );
      const centerDeltaX = nextCenter.x - pinchGestureRef.current.centerX;
      const centerDeltaY = nextCenter.y - pinchGestureRef.current.centerY;
      updatePreviewTransform(() => ({
        scale: nextScale,
        x: (pinchGestureRef.current?.x ?? 0) + centerDeltaX,
        y: (pinchGestureRef.current?.y ?? 0) + centerDeltaY,
      }));
      return;
    }

    if (panGestureRef.current?.pointerId === event.pointerId) {
      event.preventDefault();
      const gesture = panGestureRef.current;
      updatePreviewTransform((current) => ({
        ...current,
        x: gesture.x + event.clientX - gesture.startX,
        y: gesture.y + event.clientY - gesture.startY,
      }));
    }
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (panGestureRef.current?.pointerId === event.pointerId) {
      panGestureRef.current = null;
    }

    const points = Array.from(pointersRef.current.values());
    if (points.length >= 2) {
      const current = previewTransformRef.current;
      const center = pointerCenter(points);
      pinchGestureRef.current = {
        centerX: center.x,
        centerY: center.y,
        distance: pointerDistance(points),
        scale: current.scale,
        x: current.x,
        y: current.y,
      };
      return;
    }

    pinchGestureRef.current = null;
    if (points.length === 1 && previewTransformRef.current.scale > MIN_PREVIEW_SCALE) {
      const [point] = points;
      const [[pointerId]] = pointersRef.current;
      const current = previewTransformRef.current;
      panGestureRef.current = {
        pointerId,
        startX: point.x,
        startY: point.y,
        x: current.x,
        y: current.y,
      };
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
        <header className="preview-toolbar">
          <div className="preview-title" title={group?.stem ?? ""}>
            <strong>{group?.stem ?? t("preview.title")}</strong>
            <span>
              {group
                ? `${group.folderName} - ${formatBytes(group.totalSize)}`
                : t("preview.loading")}
            </span>
          </div>
          <div
            className="preview-actions"
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {message ? <span className="preview-action-message">{message}</span> : null}
            <Button disabled={!externalPath} onClick={openExternal}>
              <ExternalLink size={15} />
              {t("preview.openExternal")}
            </Button>
          </div>
        </header>

        <div className="preview-stage">
          {canNavigate ? (
            <ButtonBase
              aria-label={t("preview.previous")}
              className="preview-nav previous"
              component="button"
              onClick={() => movePreview(-1)}
              type="button"
            >
              <ChevronLeft size={28} />
            </ButtonBase>
          ) : null}

          <div
            className={`preview-image-frame ${previewTransform.scale > MIN_PREVIEW_SCALE ? "is-zoomed" : ""}`}
            onPointerCancel={handlePointerEnd}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            ref={imageFrameRef}
          >
            {previewPath ? (
              <img
                className={loaded ? "loaded" : ""}
                src={convertFileSrc(previewPath)}
                alt=""
                decoding="async"
                onLoad={() => setLoaded(true)}
                style={{
                  transform: `translate3d(${previewTransform.x}px, ${previewTransform.y}px, 0) scale(${previewTransform.scale})`,
                }}
              />
            ) : detailQuery.isFetching || previewQuery.isFetching ? (
              <div className="preview-loading">
                <span />
                {t("preview.loading")}
              </div>
            ) : (
              <div className="preview-empty">
                <Image size={42} />
                <strong>{t("preview.unavailable")}</strong>
                <span>{t("preview.unavailableDescription")}</span>
              </div>
            )}
          </div>

          {canNavigate ? (
            <ButtonBase
              aria-label={t("preview.next")}
              className="preview-nav next"
              component="button"
              onClick={() => movePreview(1)}
              type="button"
            >
              <ChevronRight size={28} />
            </ButtonBase>
          ) : null}
        </div>
      </div>
    </div>
  );
}
