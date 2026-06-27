import { useCallback, useEffect, useRef, useState } from "react";
import { MEDIA_SWITCH_FADE_MS, MEDIA_SWITCH_SETTLE_MS } from "../features/app/app-config";
import type { GroupKindFilter, MediaKindFilter } from "../types";

export function useMediaMode() {
  const [groupKind, setGroupKind] = useState<GroupKindFilter>("all");
  const [mediaKind, setMediaKind] = useState<MediaKindFilter>("photos");
  const [mediaTransitioning, setMediaTransitioning] = useState(false);
  const mediaFadeTimerRef = useRef<number | undefined>(undefined);
  const mediaSettleTimerRef = useRef<number | undefined>(undefined);

  const clearMediaTransitionTimers = useCallback(() => {
    if (mediaFadeTimerRef.current !== undefined) {
      window.clearTimeout(mediaFadeTimerRef.current);
      mediaFadeTimerRef.current = undefined;
    }
    if (mediaSettleTimerRef.current !== undefined) {
      window.clearTimeout(mediaSettleTimerRef.current);
      mediaSettleTimerRef.current = undefined;
    }
  }, []);

  useEffect(() => () => clearMediaTransitionTimers(), [clearMediaTransitionTimers]);

  const switchMediaKind = useCallback(
    (nextKind: MediaKindFilter, onCommit: () => void) => {
      if (nextKind === mediaKind || mediaTransitioning) return;

      clearMediaTransitionTimers();
      setMediaTransitioning(true);

      mediaFadeTimerRef.current = window.setTimeout(() => {
        setMediaKind(nextKind);
        setGroupKind("all");
        onCommit();
        mediaFadeTimerRef.current = undefined;

        mediaSettleTimerRef.current = window.setTimeout(() => {
          setMediaTransitioning(false);
          mediaSettleTimerRef.current = undefined;
        }, MEDIA_SWITCH_SETTLE_MS);
      }, MEDIA_SWITCH_FADE_MS);
    },
    [clearMediaTransitionTimers, mediaKind, mediaTransitioning],
  );

  return {
    groupKind,
    mediaKind,
    mediaTransitioning,
    setGroupKind,
    switchMediaKind,
  };
}
