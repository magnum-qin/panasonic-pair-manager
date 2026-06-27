import { useCallback, useState, type MutableRefObject } from "react";
import { openPhotoFile, openPhotoGroup } from "../api";
import type { TranslationKey } from "../i18n";
import type { PhotoGroup } from "../types";
import { fileName } from "../utils";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function usePhotoActions({
  onOpenDelete,
  rememberActiveGroup,
  selectionModeRef,
  setMessage,
  setSelected,
  setSelectionMode,
  t,
}: {
  onOpenDelete: () => void;
  rememberActiveGroup: (id: string, sourcePath?: string) => void;
  selectionModeRef: MutableRefObject<boolean>;
  setMessage: (message: string) => void;
  setSelected: (selected: Set<string>) => void;
  setSelectionMode: (enabled: boolean) => void;
  t: Translator;
}) {
  const [contextMenu, setContextMenu] = useState<{
    group: PhotoGroup;
    x: number;
    y: number;
  } | null>(null);

  const openPhotoContextMenu = useCallback((group: PhotoGroup, x: number, y: number) => {
    setContextMenu({ group, x, y });
  }, []);

  const closePhotoContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const deleteContextGroup = useCallback(
    (group: PhotoGroup) => {
      setSelected(new Set([group.id]));
      setSelectionMode(true);
      onOpenDelete();
      setContextMenu(null);
    },
    [onOpenDelete, setSelected, setSelectionMode],
  );

  const openGroup = useCallback(
    async (id: string, force = false) => {
      if (selectionModeRef.current && !force) return;
      setContextMenu(null);
      rememberActiveGroup(id);
      setMessage(t("status.opening"));
      try {
        const path = await openPhotoGroup(id);
        setMessage(t("status.opened", { name: fileName(path) }));
      } catch (error) {
        setMessage(String(error));
      }
    },
    [rememberActiveGroup, selectionModeRef, setMessage, t],
  );

  const openFile = useCallback(
    async (path: string) => {
      setMessage(t("status.opening"));
      try {
        const openedPath = await openPhotoFile(path);
        setMessage(t("status.opened", { name: fileName(openedPath) }));
      } catch (error) {
        setMessage(String(error));
      }
    },
    [setMessage, t],
  );

  return {
    closePhotoContextMenu,
    contextMenu,
    deleteContextGroup,
    openFile,
    openGroup,
    openPhotoContextMenu,
  };
}
