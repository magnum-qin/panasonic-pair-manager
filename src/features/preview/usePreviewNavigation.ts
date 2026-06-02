import { useCallback, type Dispatch, type SetStateAction } from "react";
import { PREVIEW_WINDOW_STORAGE_KEY, type PreviewWindowState } from "./preview-types";

export function usePreviewNavigation({
  previewState,
  setPreviewState,
}: {
  previewState: PreviewWindowState;
  setPreviewState: Dispatch<SetStateAction<PreviewWindowState>>;
}) {
  const currentId = previewState.id;
  const currentIndex = currentId ? previewState.ids.indexOf(currentId) : -1;
  const canNavigate = previewState.ids.length > 1 && currentIndex >= 0;

  const setCurrentId = useCallback(
    (id: string) => {
      setPreviewState((current) => {
        const next = { ...current, id };
        window.localStorage.setItem(PREVIEW_WINDOW_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [setPreviewState],
  );

  const movePreview = useCallback(
    (direction: -1 | 1) => {
      if (!canNavigate) return;
      const nextIndex =
        (currentIndex + direction + previewState.ids.length) % previewState.ids.length;
      setCurrentId(previewState.ids[nextIndex]);
    },
    [canNavigate, currentIndex, previewState.ids, setCurrentId],
  );

  return {
    canNavigate,
    currentId,
    currentIndex,
    movePreview,
    setCurrentId,
  };
}
