import { convertFileSrc } from "@tauri-apps/api/core";
import ButtonBase from "@mui/material/ButtonBase";
import { ChevronLeft, ChevronRight, Image } from "lucide-react";
import type { PointerEventHandler, RefObject } from "react";
import type { TranslationKey } from "../../i18n";
import { MIN_PREVIEW_SCALE, type PreviewTransform } from "./preview-types";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function PreviewStage({
  canNavigate,
  imageFrameRef,
  isFetching,
  loaded,
  onImageLoad,
  onMove,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  previewPath,
  previewTransform,
  t,
}: {
  canNavigate: boolean;
  imageFrameRef: RefObject<HTMLDivElement | null>;
  isFetching: boolean;
  loaded: boolean;
  onImageLoad: () => void;
  onMove: (direction: -1 | 1) => void;
  onPointerCancel: PointerEventHandler<HTMLDivElement>;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  previewPath?: string | null;
  previewTransform: PreviewTransform;
  t: Translator;
}) {
  return (
    <div className="preview-stage">
      {canNavigate ? (
        <ButtonBase
          aria-label={t("preview.previous")}
          className="preview-nav previous"
          component="button"
          onClick={() => onMove(-1)}
          type="button"
        >
          <ChevronLeft size={28} />
        </ButtonBase>
      ) : null}

      <div
        className={`preview-image-frame ${
          previewTransform.scale > MIN_PREVIEW_SCALE ? "is-zoomed" : ""
        }`}
        onPointerCancel={onPointerCancel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={imageFrameRef}
      >
        {previewPath ? (
          <img
            className={loaded ? "loaded" : ""}
            src={convertFileSrc(previewPath)}
            alt=""
            decoding="async"
            onLoad={onImageLoad}
            style={{
              transform: `translate3d(${previewTransform.x}px, ${previewTransform.y}px, 0) scale(${previewTransform.scale})`,
            }}
          />
        ) : isFetching ? (
          <div className="preview-loading">
            <span />
            {t("preview.loading")}
          </div>
        ) : (
          <div className="preview-empty">
            <Image size={42} />
            <strong>{t("preview.unavailable")}</strong>
            <span>{t("preview.unavailableDescription")}</span>
          </div>
        )}
      </div>

      {canNavigate ? (
        <ButtonBase
          aria-label={t("preview.next")}
          className="preview-nav next"
          component="button"
          onClick={() => onMove(1)}
          type="button"
        >
          <ChevronRight size={28} />
        </ButtonBase>
      ) : null}
    </div>
  );
}
