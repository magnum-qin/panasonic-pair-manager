import type { Key } from "react";
import type { PhotoGroup } from "../types";
import { PhotoCard } from "./PhotoCard";

export interface PhotoGridVirtualRow {
  index: number;
  key: Key;
  start: number;
}

export function PhotoGridVirtualRows({
  activeId,
  cardWidth,
  columns,
  groups,
  isFetchingMore,
  loadingMoreLabel,
  noPreviewLabel,
  onActivate,
  onContextMenu,
  onOpen,
  onToggle,
  scrollToContinueLabel,
  selected,
  thumbnailSize,
  virtualRows,
}: {
  activeId: string;
  cardWidth: number;
  columns: number;
  groups: PhotoGroup[];
  isFetchingMore: boolean;
  loadingMoreLabel: string;
  noPreviewLabel: string;
  onActivate: (id: string, range?: boolean) => void;
  onContextMenu: (group: PhotoGroup, x: number, y: number) => void;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
  scrollToContinueLabel: string;
  selected: Set<string>;
  thumbnailSize: number;
  virtualRows: PhotoGridVirtualRow[];
}) {
  return (
    <>
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
    </>
  );
}
