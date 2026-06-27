import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_PREVIEW_SCALE,
  MIN_PREVIEW_SCALE,
  PREVIEW_WHEEL_ZOOM_SENSITIVITY,
  type PreviewTransform,
} from "./preview-types";
import { clamp } from "./preview-gesture-utils";
import { usePreviewPointerGestures } from "./usePreviewPointerGestures";
import { usePreviewWheelZoom } from "./usePreviewWheelZoom";

export function usePreviewGestures(previewPath: string | null | undefined) {
  const imageFrameRef = useRef<HTMLDivElement | null>(null);
  const [previewTransform, setPreviewTransform] = useState<PreviewTransform>({
    scale: MIN_PREVIEW_SCALE,
    x: 0,
    y: 0,
  });
  const previewTransformRef = useRef(previewTransform);

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

  const { handlePointerDown, handlePointerEnd, handlePointerMove, resetPointerGestures } =
    usePreviewPointerGestures({
      previewPath,
      previewTransformRef,
      updatePreviewTransform,
    });

  useEffect(() => {
    setPreviewTransform({ scale: MIN_PREVIEW_SCALE, x: 0, y: 0 });
    previewTransformRef.current = { scale: MIN_PREVIEW_SCALE, x: 0, y: 0 };
    resetPointerGestures();
  }, [previewPath, resetPointerGestures]);

  usePreviewWheelZoom({ imageFrameRef, previewPath, zoomPreview });

  return {
    handlePointerDown,
    handlePointerEnd,
    handlePointerMove,
    imageFrameRef,
    previewTransform,
  };
}
