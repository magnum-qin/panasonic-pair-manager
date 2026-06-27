import { useCallback, useEffect, useRef, useState } from "react";
import { GALLERY_LAYOUT_FADE_MS, GALLERY_LAYOUT_SETTLE_MS } from "../features/app/app-config";

export function useGalleryLayoutTransition() {
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [galleryLayoutTransitioning, setGalleryLayoutTransitioning] = useState(false);
  const galleryFadeTimerRef = useRef<number | undefined>(undefined);
  const gallerySettleTimerRef = useRef<number | undefined>(undefined);

  const clearGalleryLayoutTimers = useCallback(() => {
    if (galleryFadeTimerRef.current !== undefined) {
      window.clearTimeout(galleryFadeTimerRef.current);
      galleryFadeTimerRef.current = undefined;
    }
    if (gallerySettleTimerRef.current !== undefined) {
      window.clearTimeout(gallerySettleTimerRef.current);
      gallerySettleTimerRef.current = undefined;
    }
  }, []);

  const toggleInspector = useCallback(() => {
    if (galleryLayoutTransitioning) return;

    clearGalleryLayoutTimers();
    setGalleryLayoutTransitioning(true);

    galleryFadeTimerRef.current = window.setTimeout(() => {
      setInspectorCollapsed((current) => !current);
      galleryFadeTimerRef.current = undefined;

      gallerySettleTimerRef.current = window.setTimeout(() => {
        setGalleryLayoutTransitioning(false);
        gallerySettleTimerRef.current = undefined;
      }, GALLERY_LAYOUT_SETTLE_MS);
    }, GALLERY_LAYOUT_FADE_MS);
  }, [clearGalleryLayoutTimers, galleryLayoutTransitioning]);

  useEffect(() => () => clearGalleryLayoutTimers(), [clearGalleryLayoutTimers]);

  return {
    galleryLayoutTransitioning,
    inspectorCollapsed,
    toggleInspector,
  };
}
