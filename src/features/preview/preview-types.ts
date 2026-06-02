export const PREVIEW_WINDOW_STORAGE_KEY = "ppm.previewWindowState";
export const MIN_PREVIEW_SCALE = 1;
export const MAX_PREVIEW_SCALE = 6;
export const PREVIEW_WHEEL_ZOOM_SENSITIVITY = 0.004;
export const PREVIEW_PINCH_ZOOM_SENSITIVITY = 0.007;

export interface PreviewWindowState {
  id: string;
  ids: string[];
}

export interface PreviewTransform {
  scale: number;
  x: number;
  y: number;
}
