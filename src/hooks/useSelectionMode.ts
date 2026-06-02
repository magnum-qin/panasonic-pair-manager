import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PhotoGroup } from "../types";

export function useSelectionMode({
  hasSource,
  onActivate,
  visibleGroups,
}: {
  hasSource: boolean;
  onActivate: (id: string) => void;
  visibleGroups: PhotoGroup[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const selectionModeRef = useRef(selectionMode);
  const selectionAnchorRef = useRef<string>("");

  const selectedGroups = useMemo(
    () => visibleGroups.filter((group) => selected.has(group.id)),
    [selected, visibleGroups],
  );
  const selectedIds = useMemo(() => [...selected], [selected]);

  const clearSelection = useCallback(() => {
    selectionAnchorRef.current = "";
    setSelected(new Set());
  }, []);

  const toggleSelected = useCallback((id: string) => {
    selectionAnchorRef.current = id;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const activateOrSelect = useCallback(
    (id: string, range = false) => {
      if (selectionModeRef.current) {
        if (range && selectionAnchorRef.current) {
          const start = visibleGroups.findIndex((group) => group.id === selectionAnchorRef.current);
          const end = visibleGroups.findIndex((group) => group.id === id);
          if (start >= 0 && end >= 0) {
            const [from, to] = start < end ? [start, end] : [end, start];
            setSelected((current) => {
              const next = new Set(current);
              visibleGroups.slice(from, to + 1).forEach((group) => next.add(group.id));
              return next;
            });
            return;
          }
        }
        toggleSelected(id);
      } else {
        onActivate(id);
      }
    },
    [onActivate, toggleSelected, visibleGroups],
  );

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((current) => {
      if (current) clearSelection();
      return !current;
    });
  }, [clearSelection]);

  const selectAllVisibleGroups = useCallback(() => {
    if (!visibleGroups.length) return;
    setSelectionMode(true);
    setSelected(new Set(visibleGroups.map((group) => group.id)));
    selectionAnchorRef.current = visibleGroups[0].id;
  }, [visibleGroups]);

  useEffect(() => {
    selectionModeRef.current = selectionMode;
  }, [selectionMode]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (isEditable || !hasSource || !visibleGroups.length) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSelectionMode(true);
        setSelected(new Set(visibleGroups.map((group) => group.id)));
        selectionAnchorRef.current = visibleGroups[0].id;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasSource, visibleGroups]);

  return {
    activateOrSelect,
    clearSelection,
    selected,
    selectedGroups,
    selectedIds,
    selectionMode,
    selectionModeRef,
    selectAllVisibleGroups,
    setSelected,
    setSelectionMode,
    toggleSelected,
    toggleSelectionMode,
  };
}
