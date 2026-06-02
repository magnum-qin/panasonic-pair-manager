import type { QueryClient } from "@tanstack/react-query";
import { emitTo } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useCallback, type RefObject } from "react";
import { getPhotoGroup } from "../api";
import {
  PREVIEW_WINDOW_BACKGROUNDS,
  PREVIEW_WINDOW_LABEL,
  PREVIEW_WINDOW_STORAGE_KEY,
} from "../features/app/app-config";
import type { ThemeCode } from "../theme-options";
import type { PhotoGroup } from "../types";

export function usePreviewWindow({
  onActivate,
  onError,
  queryClient,
  selectionModeRef,
  setContextMenuClosed,
  theme,
  visibleGroups,
}: {
  onActivate: (id: string) => void;
  onError: (message: string) => void;
  queryClient: QueryClient;
  selectionModeRef: RefObject<boolean>;
  setContextMenuClosed: () => void;
  theme: ThemeCode;
  visibleGroups: PhotoGroup[];
}) {
  return useCallback(
    async (id: string, force = false) => {
      if (selectionModeRef.current && !force) return;
      setContextMenuClosed();
      onActivate(id);
      const state = { id, ids: visibleGroups.map((group) => group.id) };
      window.localStorage.setItem(PREVIEW_WINDOW_STORAGE_KEY, JSON.stringify(state));
      queryClient.prefetchQuery({
        queryFn: () => getPhotoGroup(id),
        queryKey: ["photo-group-detail", id],
      });
      const group = visibleGroups.find((item) => item.id === id);
      const existing = await WebviewWindow.getByLabel(PREVIEW_WINDOW_LABEL);
      if (existing) {
        await emitTo(PREVIEW_WINDOW_LABEL, "preview-window-state", state);
        await existing.setTitle(`${group?.stem ?? "Photo"} - Panasonic Pair Manager`);
        await existing.setFocus();
        return;
      }
      const previewWindow = new WebviewWindow(PREVIEW_WINDOW_LABEL, {
        backgroundColor: PREVIEW_WINDOW_BACKGROUNDS[theme],
        center: true,
        focus: true,
        height: 820,
        minHeight: 520,
        minWidth: 780,
        title: "Photo Preview - Panasonic Pair Manager",
        url: "/?previewWindow=1",
        visible: false,
        width: 1180,
        zoomHotkeysEnabled: true,
      });
      previewWindow.once("tauri://error", (event) => {
        onError(String(event.payload));
      });
    },
    [
      onActivate,
      onError,
      queryClient,
      selectionModeRef,
      setContextMenuClosed,
      theme,
      visibleGroups,
    ],
  );
}
