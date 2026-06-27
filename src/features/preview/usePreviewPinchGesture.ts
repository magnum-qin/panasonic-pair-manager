import { useCallback, useRef, type MutableRefObject } from "react";
import { MAX_PREVIEW_SCALE, MIN_PREVIEW_SCALE, type PreviewTransform } from "./preview-types";
import { clamp, pointerCenter, pointerDistance, type PreviewPoint } from "./preview-gesture-utils";

interface PinchGesture {
  centerX: number;
  centerY: number;
  distance: number;
  scale: number;
  x: number;
  y: number;
}

export function usePreviewPinchGesture({
  previewTransformRef,
  updatePreviewTransform,
}: {
  previewTransformRef: MutableRefObject<PreviewTransform>;
  updatePreviewTransform: (updater: (current: PreviewTransform) => PreviewTransform) => void;
}) {
  const pinchGestureRef = useRef<PinchGesture | null>(null);

  const resetPinchGesture = useCallback(() => {
    pinchGestureRef.current = null;
  }, []);

  const startPinchGesture = useCallback(
    (points: PreviewPoint[]) => {
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
    },
    [previewTransformRef],
  );

  const updatePinchGesture = useCallback(
    (points: PreviewPoint[]) => {
      if (points.length < 2 || !pinchGestureRef.current) return false;
      const nextDistance = pointerDistance(points);
      const nextCenter = pointerCenter(points);
      if (!nextDistance || !pinchGestureRef.current.distance) return false;
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
      return true;
    },
    [updatePreviewTransform],
  );

  return {
    resetPinchGesture,
    startPinchGesture,
    updatePinchGesture,
  };
}
