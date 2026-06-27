import { convertFileSrc } from "@tauri-apps/api/core";
import { Check, ImageOff, Video } from "lucide-react";
import { memo, useState, type MouseEvent } from "react";
import { usePhotoCardThumbnail } from "../hooks/usePhotoCardThumbnail";
import type { PhotoGroup } from "../types";
import { formatBytes } from "../utils";

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
  const [isPressed, setIsPressed] = useState(false);
  const { imageLoaded, isFetching, isVideo, markImageLoaded, thumbnailPath } =
    usePhotoCardThumbnail(group, thumbnailSize);

  const handlePrimaryAction = (range?: boolean) => {
    onActivate(group.id, range);
  };

  return (
    <article
      className={`photo-card ${isSelected ? "selected" : ""} ${isActive ? "active" : ""} ${isPressed ? "pressed" : ""}`}
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
        onPointerCancel={() => setIsPressed(false)}
        onPointerDown={() => setIsPressed(true)}
        onPointerLeave={() => setIsPressed(false)}
        onPointerUp={() => setIsPressed(false)}
      >
        <div
          className={`thumb ${
            (thumbnailPath || group.rawCount > 0) && !imageLoaded ? "loading" : ""
          }`}
        >
          {thumbnailPath ? (
            <img
              className={imageLoaded ? "loaded" : ""}
              src={convertFileSrc(thumbnailPath)}
              alt=""
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              onLoad={markImageLoaded}
            />
          ) : isFetching ? (
            <div className="thumb-pending" aria-label="Loading thumbnail" />
          ) : isVideo ? (
            <div className="no-preview video-preview">
              <Video size={34} />
              <span>{noPreviewLabel}</span>
            </div>
          ) : (
            <div className="no-preview">
              <ImageOff size={30} />
              <span>{noPreviewLabel}</span>
            </div>
          )}
          <div className="badges">
            {group.rawCount > 0 && <span>RAW</span>}
            {group.jpgCount > 0 && <span>JPG</span>}
            {group.videoCount > 0 && <span>VIDEO</span>}
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
