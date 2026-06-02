import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useMemo, type RefObject } from "react";
import { PREVIEW_PINCH_ZOOM_SENSITIVITY, PREVIEW_WHEEL_ZOOM_SENSITIVITY } from "./preview-types";

export function usePreviewWheelZoom({
  imageFrameRef,
  previewPath,
  zoomPreview,
}: {
  imageFrameRef: RefObject<HTMLDivElement | null>;
  previewPath: string | null | undefined;
  zoomPreview: (deltaY: number, sensitivity?: number) => void;
}) {
  const currentWebview = useMemo(() => getCurrentWebview(), []);

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
  }, [currentWebview, imageFrameRef, previewPath, zoomPreview]);

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
}
