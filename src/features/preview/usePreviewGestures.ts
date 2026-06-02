import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  MAX_PREVIEW_SCALE,
  MIN_PREVIEW_SCALE,
  PREVIEW_PINCH_ZOOM_SENSITIVITY,
  PREVIEW_WHEEL_ZOOM_SENSITIVITY,
  type PreviewTransform,
} from "./preview-types";

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

export function usePreviewGestures(previewPath: string | null | undefined) {
  const currentWebview = useMemo(() => getCurrentWebview(), []);
  const imageFrameRef = useRef<HTMLDivElement | null>(null);
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
