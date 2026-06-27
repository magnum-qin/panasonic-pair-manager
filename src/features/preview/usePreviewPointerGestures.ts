import { useCallback, useRef, type MutableRefObject, type PointerEvent } from "react";
import { MIN_PREVIEW_SCALE, type PreviewTransform } from "./preview-types";
import type { PreviewPoint } from "./preview-gesture-utils";
import { usePreviewPanGesture } from "./usePreviewPanGesture";
import { usePreviewPinchGesture } from "./usePreviewPinchGesture";

export function usePreviewPointerGestures({
  previewPath,
  previewTransformRef,
  updatePreviewTransform,
}: {
  previewPath: string | null | undefined;
  previewTransformRef: MutableRefObject<PreviewTransform>;
  updatePreviewTransform: (updater: (current: PreviewTransform) => PreviewTransform) => void;
}) {
  const pointersRef = useRef(new Map<number, PreviewPoint>());
  const { endPanGesture, resetPanGesture, startPanGesture, updatePanGesture } =
    usePreviewPanGesture({
      previewTransformRef,
      updatePreviewTransform,
    });
  const { resetPinchGesture, startPinchGesture, updatePinchGesture } = usePreviewPinchGesture({
    previewTransformRef,
    updatePreviewTransform,
  });

  const resetPointerGestures = useCallback(() => {
    pointersRef.current.clear();
    resetPanGesture();
    resetPinchGesture();
  }, [resetPanGesture, resetPinchGesture]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!previewPath) return;
    if (event.pointerType === "mouse" && previewTransformRef.current.scale <= MIN_PREVIEW_SCALE)
      return;

    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const points = Array.from(pointersRef.current.values());
    if (points.length >= 2) {
      startPinchGesture(points);
      resetPanGesture();
      return;
    }

    startPanGesture(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;

    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = Array.from(pointersRef.current.values());

    if (updatePinchGesture(points)) {
      event.preventDefault();
      return;
    }

    if (updatePanGesture(event.pointerId, { x: event.clientX, y: event.clientY })) {
      event.preventDefault();
    }
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    endPanGesture(event.pointerId);

    const points = Array.from(pointersRef.current.values());
    if (points.length >= 2) {
      startPinchGesture(points);
      return;
    }

    resetPinchGesture();
    if (points.length === 1 && previewTransformRef.current.scale > MIN_PREVIEW_SCALE) {
      const [point] = points;
      const [[pointerId]] = pointersRef.current;
      startPanGesture(pointerId, point);
    }
  };

  return {
    handlePointerDown,
    handlePointerEnd,
    handlePointerMove,
    resetPointerGestures,
  };
}
