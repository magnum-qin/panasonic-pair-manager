import { convertFileSrc } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";
import { Check, ImageOff } from "lucide-react";
import { memo, useEffect, useState } from "react";
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
  onOpen,
  onToggle,
}: {
  group: PhotoGroup;
  isActive: boolean;
  isSelected: boolean;
  thumbnailSize: number;
  onActivate: (id: string) => void;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const thumbnailQuery = useQuery({
    enabled: Boolean(group.previewPath),
    queryFn: () => getPhotoThumbnail(group.id, thumbnailSize),
    queryKey: ["photo-thumbnail", group.id, thumbnailSize],
    staleTime: Number.POSITIVE_INFINITY,
  });
  const thumbnailPath = thumbnailQuery.data;

  useEffect(() => {
    setImageLoaded(Boolean(thumbnailPath && loadedThumbnailPaths.has(thumbnailPath)));
  }, [thumbnailPath]);

  return (
    <article
      className={`photo-card ${isSelected ? "selected" : ""} ${isActive ? "active" : ""}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        if (event.detail > 1) return;
        onActivate(group.id);
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen(group.id);
      }}
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
      <div className={`thumb ${group.previewPath && !imageLoaded ? "loading" : ""}`}>
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
        ) : group.previewPath && thumbnailQuery.isFetching ? (
          <div className="thumb-pending" aria-label="Loading thumbnail" />
        ) : (
          <div className="no-preview">
            <ImageOff size={30} />
            <span>No JPG preview</span>
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
    </article>
  );
});
