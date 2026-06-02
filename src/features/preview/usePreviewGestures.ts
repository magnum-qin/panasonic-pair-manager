import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import {
  MAX_PREVIEW_SCALE,
  MIN_PREVIEW_SCALE,
  PREVIEW_WHEEL_ZOOM_SENSITIVITY,
  type PreviewTransform,
} from "./preview-types";
import { clamp, pointerCenter, pointerDistance, type PreviewPoint } from "./preview-gesture-utils";
import { usePreviewWheelZoom } from "./usePreviewWheelZoom";

export function usePreviewGestures(previewPath: string | null | undefined) {
  const imageFrameRef = useRef<HTMLDivElement | null>(null);
  const [previewTransform, setPreviewTransform] = useState<PreviewTransform>({
    scale: MIN_PREVIEW_SCALE,
    x: 0,
    y: 0,
  });
  const previewTransformRef = useRef(previewTransform);
  const pointersRef = useRef(new Map<number, PreviewPoint>());
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

  useEffect(() => {
    setPreviewTransform({ scale: MIN_PREVIEW_SCALE, x: 0, y: 0 });
    previewTransformRef.current = { scale: MIN_PREVIEW_SCALE, x: 0, y: 0 };
    pointersRef.current.clear();
    panGestureRef.current = null;
    pinchGestureRef.current = null;
  }, [previewPath]);

  usePreviewWheelZoom({ imageFrameRef, previewPath, zoomPreview });

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

  return {
    handlePointerDown,
    handlePointerEnd,
    handlePointerMove,
    imageFrameRef,
    previewTransform,
  };
}
