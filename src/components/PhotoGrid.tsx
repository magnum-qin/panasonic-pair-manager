import { useVirtualizer } from "@tanstack/react-virtual";
import { ImageOff } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PhotoGroup } from "../types";
import { formatBytes } from "../utils";
import { PhotoCard } from "./PhotoCard";

const GRID_GAP = 14;
const GRID_PADDING = 18;
const THUMBNAIL_SIZE_STEP = 80;

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    setWidth(element.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

export function PhotoGrid({
  activeId,
  emptyActionLabel,
  emptyDescription = "Select a folder and scan for `.RW2` / `.JPG` pairs.",
  emptyTitle = "No photo groups yet",
  galleryTitle,
  groups,
  hasMore,
  isFetchingMore,
  loadingMoreLabel,
  minCardWidth,
  noPreviewLabel,
  onActivate,
  onEmptyAction,
  onLoadMore,
  onOpen,
  onToggle,
  photoGroupsLabel,
  scrollToContinueLabel,
  selected,
}: {
  activeId: string;
  emptyActionLabel?: string;
  emptyDescription?: string;
  emptyTitle?: string;
  galleryTitle: string;
  groups: PhotoGroup[];
  hasMore: boolean;
  isFetchingMore: boolean;
  loadingMoreLabel: string;
  minCardWidth: number;
  noPreviewLabel: string;
  onActivate: (id: string) => void;
  onEmptyAction?: () => void;
  onLoadMore: () => void;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
  photoGroupsLabel: string;
  scrollToContinueLabel: string;
  selected: Set<string>;
}) {
  const [scrollRef, width] = useElementWidth<HTMLElement>();
  const contentWidth = Math.max(width - GRID_PADDING * 2, minCardWidth);
  const columns = Math.max(
    1,
    Math.floor((contentWidth + GRID_GAP) / (minCardWidth + GRID_GAP)),
  );
  const cardWidth = minCardWidth;
  const rowHeight = Math.round(cardWidth * 0.75 + 72 + GRID_GAP);
  const thumbnailSize = Math.min(
    480,
    Math.max(240, Math.ceil((cardWidth * 1.15) / THUMBNAIL_SIZE_STEP) * THUMBNAIL_SIZE_STEP),
  );
  const groupRowCount = Math.ceil(groups.length / columns);
  const rowCount = groupRowCount + (hasMore ? 1 : 0);
  const totalSize = useMemo(
    () => groups.reduce((sum, group) => sum + group.totalSize, 0),
    [groups],
  );

  const virtualizer = useVirtualizer({
    count: rowCount,
    estimateSize: () => rowHeight,
    getScrollElement: () => scrollRef.current,
    overscan: 1,
  });
  const virtualRows = virtualizer.getVirtualItems();

  useEffect(() => {
    const lastRow = virtualRows[virtualRows.length - 1];
    if (!lastRow || !hasMore || isFetchingMore) return;
    if (lastRow.index >= groupRowCount - 3) {
      onLoadMore();
    }
  }, [groupRowCount, hasMore, isFetchingMore, onLoadMore, virtualRows]);

  return (
    <section className="gallery" ref={scrollRef}>
      <div className="gallery-header">
        <div>
          <h2>{galleryTitle}</h2>
          <span>{photoGroupsLabel}</span>
        </div>
        <span>{formatBytes(totalSize)}</span>
      </div>

      {!groups.length ? (
        <div className="grid">
          <div className="gallery-empty action-empty">
            <ImageOff size={38} />
            <strong>{emptyTitle}</strong>
            <span>{emptyDescription}</span>
            {emptyActionLabel && onEmptyAction ? (
              <button onClick={onEmptyAction}>{emptyActionLabel}</button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="virtual-grid" style={{ height: virtualizer.getTotalSize() }}>
          {virtualRows.map((virtualRow) => {
            const start = virtualRow.index * columns;
            const rowGroups = groups.slice(start, start + columns);
            const isLoaderRow = virtualRow.index >= groupRowCount;
            return (
              <div
                className={`virtual-row ${isLoaderRow ? "virtual-loader-row" : ""}`}
                key={virtualRow.key}
                style={{
                  gridTemplateColumns: `repeat(${columns}, ${cardWidth}px)`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {isLoaderRow ? (
                  <div className="inline-loader" aria-live="polite">
                    <span />
                    <strong>{isFetchingMore ? loadingMoreLabel : scrollToContinueLabel}</strong>
                  </div>
                ) : (
                  rowGroups.map((group) => (
                    <PhotoCard
                      group={group}
                      isActive={activeId === group.id}
                      isSelected={selected.has(group.id)}
                      key={group.id}
                      noPreviewLabel={noPreviewLabel}
                      thumbnailSize={thumbnailSize}
                      onActivate={onActivate}
                      onOpen={onOpen}
                      onToggle={onToggle}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
