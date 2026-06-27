import { useCallback, useRef, type MutableRefObject } from "react";
import { MIN_PREVIEW_SCALE, type PreviewTransform } from "./preview-types";
import type { PreviewPoint } from "./preview-gesture-utils";

interface PanGesture {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
}

export function usePreviewPanGesture({
  previewTransformRef,
  updatePreviewTransform,
}: {
  previewTransformRef: MutableRefObject<PreviewTransform>;
  updatePreviewTransform: (updater: (current: PreviewTransform) => PreviewTransform) => void;
}) {
  const panGestureRef = useRef<PanGesture | null>(null);

  const resetPanGesture = useCallback(() => {
    panGestureRef.current = null;
  }, []);

  const startPanGesture = useCallback(
    (pointerId: number, point: PreviewPoint) => {
      if (previewTransformRef.current.scale <= MIN_PREVIEW_SCALE) return;
      const current = previewTransformRef.current;
      panGestureRef.current = {
        pointerId,
        startX: point.x,
        startY: point.y,
        x: current.x,
        y: current.y,
      };
    },
    [previewTransformRef],
  );

  const updatePanGesture = useCallback(
    (pointerId: number, point: PreviewPoint) => {
      if (panGestureRef.current?.pointerId !== pointerId) return false;
      const gesture = panGestureRef.current;
      updatePreviewTransform((current) => ({
        ...current,
        x: gesture.x + point.x - gesture.startX,
        y: gesture.y + point.y - gesture.startY,
      }));
      return true;
    },
    [updatePreviewTransform],
  );

  const endPanGesture = useCallback((pointerId: number) => {
    if (panGestureRef.current?.pointerId === pointerId) {
      panGestureRef.current = null;
    }
  }, []);

  return {
    endPanGesture,
    resetPanGesture,
    startPanGesture,
    updatePanGesture,
  };
}
