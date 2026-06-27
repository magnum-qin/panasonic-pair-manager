import { useCallback, useEffect, type MutableRefObject } from "react";
import { activeMemoryKey } from "../features/app/app-utils";
import type { GroupKindFilter, MediaKindFilter, PhotoGroup } from "../types";

export function useGalleryStateCoordinator({
  activeByRootRef,
  activeId,
  clearActiveSource,
  clearSelection,
  fetchNextGroups,
  groupsHasNextPage,
  groupsIsFetchingNextPage,
  hasSource,
  mediaKind,
  rememberActiveGroup,
  rootPath,
  setActiveId,
  setGroupKind,
  setInspectorTab,
  transitionMediaKind,
  visibleGroups,
}: {
  activeByRootRef: MutableRefObject<Record<string, string>>;
  activeId: string;
  clearActiveSource: () => void;
  clearSelection: () => void;
  fetchNextGroups: () => void;
  groupsHasNextPage: boolean;
  groupsIsFetchingNextPage: boolean;
  hasSource: boolean;
  mediaKind: MediaKindFilter;
  rememberActiveGroup: (id: string, sourcePath?: string) => void;
  rootPath: string;
  setActiveId: (id: string) => void;
  setGroupKind: (kind: GroupKindFilter) => void;
  setInspectorTab: (tab: "info" | "metadata") => void;
  transitionMediaKind: (kind: MediaKindFilter, onCommit: () => void) => void;
  visibleGroups: PhotoGroup[];
}) {
  const applyKindFilter = useCallback(
    (nextKind: GroupKindFilter) => {
      setGroupKind(nextKind);
      clearSelection();
      setActiveId("");
    },
    [clearSelection, setActiveId, setGroupKind],
  );

  const switchMediaKind = useCallback(
    (nextKind: MediaKindFilter) => {
      transitionMediaKind(nextKind, () => {
        clearSelection();
        setActiveId("");
        setInspectorTab("info");
      });
    },
    [clearSelection, setActiveId, setInspectorTab, transitionMediaKind],
  );

  const loadMoreGroups = useCallback(() => {
    if (groupsHasNextPage && !groupsIsFetchingNextPage) {
      fetchNextGroups();
    }
  }, [fetchNextGroups, groupsHasNextPage, groupsIsFetchingNextPage]);

  useEffect(() => {
    clearSelection();
    setActiveId(
      rootPath ? (activeByRootRef.current[activeMemoryKey(rootPath, mediaKind)] ?? "") : "",
    );
    setInspectorTab("info");
  }, [activeByRootRef, clearSelection, mediaKind, rootPath, setActiveId, setInspectorTab]);

  useEffect(() => {
    if (!visibleGroups.length) {
      if (activeId) setActiveId("");
      return;
    }

    if (activeId && visibleGroups.some((group) => group.id === activeId)) return;

    const rememberedId = rootPath
      ? activeByRootRef.current[activeMemoryKey(rootPath, mediaKind)]
      : "";
    const nextId =
      rememberedId && visibleGroups.some((group) => group.id === rememberedId)
        ? rememberedId
        : visibleGroups[0].id;
    rememberActiveGroup(nextId, rootPath);
  }, [
    activeByRootRef,
    activeId,
    mediaKind,
    rememberActiveGroup,
    rootPath,
    setActiveId,
    visibleGroups,
  ]);

  useEffect(() => {
    if (hasSource) return;
    clearActiveSource();
  }, [clearActiveSource, hasSource]);

  useEffect(() => {
    setInspectorTab("info");
  }, [activeId, setInspectorTab]);

  return {
    applyKindFilter,
    loadMoreGroups,
    switchMediaKind,
  };
}
