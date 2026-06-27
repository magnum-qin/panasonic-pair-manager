import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, type ReactNode } from "react";
import { useElementWidth } from "../hooks/useElementWidth";
import type { PhotoGroup } from "../types";
import { formatBytes } from "../utils";
import { PhotoCard } from "./PhotoCard";
import { PhotoGridEmptyState } from "./PhotoGridEmptyState";

const GRID_GAP = 14;
const GRID_PADDING = 18;
const THUMBNAIL_SIZE_STEP = 80;

export function PhotoGrid({
  activeId,
  emptyActionLabel,
  emptyDescription = "Select a folder and scan for `.RW2` / `.JPG` pairs.",
  emptyIcon,
  emptyTitle = "No photo groups yet",
  galleryTitle,
  groups,
  hasMore,
  headerControls,
  isMediaTransitioning = false,
  isFetchingMore,
  loadingMoreLabel,
  minCardWidth,
  noPreviewLabel,
  onActivate,
  onContextMenu,
  onEmptyAction,
  onLoadMore,
  onOpen,
  onToggle,
  photoGroupsLabel,
  scrollToContinueLabel,
  selected,
  totalGroups,
}: {
  activeId: string;
  emptyActionLabel?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  galleryTitle: string;
  groups: PhotoGroup[];
  hasMore: boolean;
  headerControls?: ReactNode;
  isMediaTransitioning?: boolean;
  isFetchingMore: boolean;
  loadingMoreLabel: string;
  minCardWidth: number;
  noPreviewLabel: string;
  onActivate: (id: string, range?: boolean) => void;
  onContextMenu: (group: PhotoGroup, x: number, y: number) => void;
  onEmptyAction?: () => void;
  onLoadMore: () => void;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
  photoGroupsLabel: string;
  scrollToContinueLabel: string;
  selected: Set<string>;
  totalGroups: number;
}) {
  const [scrollRef, width] = useElementWidth<HTMLDivElement>();
  const contentWidth = Math.max(width - GRID_PADDING * 2, minCardWidth);
  const columns = Math.max(1, Math.floor((contentWidth + GRID_GAP) / (minCardWidth + GRID_GAP)));
  const cardWidth = minCardWidth;
  const rowHeight = Math.round(cardWidth * 0.75 + 72 + GRID_GAP);
  const thumbnailSize = Math.min(
    480,
    Math.max(240, Math.ceil((cardWidth * 1.15) / THUMBNAIL_SIZE_STEP) * THUMBNAIL_SIZE_STEP),
  );
  const loadedRowCount = Math.ceil(groups.length / columns);
  const totalGroupCount = Math.max(groups.length, totalGroups);
  const rowCount = Math.ceil(totalGroupCount / columns);
  const totalSize = headerControls ? 0 : groups.reduce((sum, group) => sum + group.totalSize, 0);

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
    if (lastRow.index >= loadedRowCount - 3) {
      onLoadMore();
    }
  }, [hasMore, isFetchingMore, loadedRowCount, onLoadMore, virtualRows]);

  return (
    <section className="gallery">
      <div className="gallery-header">
        {headerControls ? (
          <div className="gallery-controls-row">{headerControls}</div>
        ) : (
          <>
            <div>
              <h2>{galleryTitle}</h2>
              <span>{photoGroupsLabel}</span>
            </div>
            <span>{formatBytes(totalSize)}</span>
          </>
        )}
      </div>

      <div
        className={`gallery-scroll ${isMediaTransitioning ? "media-transitioning" : ""}`}
        ref={scrollRef}
      >
        {!groups.length && !totalGroupCount ? (
          <PhotoGridEmptyState
            actionLabel={emptyActionLabel}
            description={emptyDescription}
            icon={emptyIcon}
            onAction={onEmptyAction}
            title={emptyTitle}
          />
        ) : (
          <div className="virtual-grid" style={{ height: virtualizer.getTotalSize() }}>
            {virtualRows.map((virtualRow) => {
              const start = virtualRow.index * columns;
              const rowGroups = groups.slice(start, start + columns);
              const isLoaderRow = start >= groups.length;
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
                        onContextMenu={onContextMenu}
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
      </div>
    </section>
  );
}
