import { convertFileSrc } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";
import { Check, ImageOff } from "lucide-react";
import { memo, useEffect, useState, type MouseEvent } from "react";
import { getPhotoThumbnail } from "../api";
import type { PhotoGroup } from "../types";
import { formatBytes } from "../utils";

const loadedThumbnailPaths = new Set<string>();

export const PhotoCard = memo(function PhotoCard({
  group,
  isActive,
  isSelected,
  thumbnailSize,
  onActivate,
  onContextMenu,
  onOpen,
  onToggle,
  noPreviewLabel,
}: {
  group: PhotoGroup;
  isActive: boolean;
  isSelected: boolean;
  noPreviewLabel: string;
  thumbnailSize: number;
  onActivate: (id: string, range?: boolean) => void;
  onContextMenu: (group: PhotoGroup, x: number, y: number) => void;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const thumbnailQuery = useQuery({
    enabled: group.jpgCount > 0 || group.rawCount > 0,
    queryFn: () => getPhotoThumbnail(group.id, thumbnailSize),
    queryKey: ["photo-thumbnail", group.id, thumbnailSize],
    staleTime: Number.POSITIVE_INFINITY,
  });
  const thumbnailPath = thumbnailQuery.data;

  useEffect(() => {
    setImageLoaded(Boolean(thumbnailPath && loadedThumbnailPaths.has(thumbnailPath)));
  }, [thumbnailPath]);

  const handlePrimaryAction = (range?: boolean) => {
    onActivate(group.id, range);
  };

  return (
    <article
      className={`photo-card ${isSelected ? "selected" : ""} ${isActive ? "active" : ""}`}
    >
      <button
        className="check"
        aria-label={`Select ${group.stem}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggle(group.id);
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {isSelected ? <Check size={15} /> : ""}
      </button>
      <button
        className="photo-card-action"
        aria-pressed={isActive || isSelected}
        aria-label={`${group.stem}, ${group.folderName}, ${formatBytes(group.totalSize)}`}
        onClick={(event) => handlePrimaryAction(event.shiftKey)}
        onContextMenu={(event: MouseEvent<HTMLButtonElement>) => {
          event.preventDefault();
          event.stopPropagation();
          onActivate(group.id);
          onContextMenu(group, event.clientX, event.clientY);
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onOpen(group.id);
        }}
      >
        <div className={`thumb ${(group.previewPath || group.rawCount > 0) && !imageLoaded ? "loading" : ""}`}>
          {thumbnailPath ? (
            <img
              className={imageLoaded ? "loaded" : ""}
              src={convertFileSrc(thumbnailPath)}
              alt=""
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              onLoad={() => {
                loadedThumbnailPaths.add(thumbnailPath);
                setImageLoaded(true);
              }}
            />
          ) : (group.previewPath || group.rawCount > 0) && thumbnailQuery.isFetching ? (
            <div className="thumb-pending" aria-label="Loading thumbnail" />
          ) : (
            <div className="no-preview">
              <ImageOff size={30} />
              <span>{noPreviewLabel}</span>
            </div>
          )}
          <div className="badges">
            {group.rawCount > 0 && <span>RAW</span>}
            {group.jpgCount > 0 && <span>JPG</span>}
          </div>
        </div>
        <div className="card-meta">
          <strong>{group.stem}</strong>
          <span>{group.folderName}</span>
          <span>{formatBytes(group.totalSize)}</span>
        </div>
      </button>
    </article>
  );
});
