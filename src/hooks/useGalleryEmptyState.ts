import { useMemo } from "react";
import type { TranslationKey } from "../i18n";
import type { MediaKindFilter } from "../types";

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function useGalleryEmptyState({
  activeSourceIsManual,
  activeSourceIsRemovable,
  hasSource,
  mediaKind,
  rootIsAvailable,
  rootPath,
  scanProgressText,
  scanning,
  sourceName,
  sourceWasScanned,
  t,
}: {
  activeSourceIsManual: boolean;
  activeSourceIsRemovable: boolean;
  hasSource: boolean;
  mediaKind: MediaKindFilter;
  rootIsAvailable: boolean;
  rootPath: string;
  scanProgressText: string;
  scanning: boolean;
  sourceName: string;
  sourceWasScanned: boolean;
  t: Translator;
}) {
  return useMemo(() => {
    if (hasSource && !rootIsAvailable) {
      return {
        title: t("empty.sourceOfflineTitle"),
        description: activeSourceIsManual
          ? t("empty.fixedOfflineDescription")
          : t("empty.removableOfflineDescription"),
      };
    }
    if (scanning && rootPath) {
      return {
        title: t("empty.scanningTitle", { name: sourceName || rootPath }),
        description: scanProgressText || t("empty.scanningDescription"),
      };
    }
    if (hasSource && !sourceWasScanned) {
      return {
        title: t("empty.unscannedTitle"),
        description: activeSourceIsRemovable
          ? t("empty.unscannedRemovableDescription")
          : t("empty.unscannedDescription"),
      };
    }
    if (hasSource && sourceWasScanned) {
      return {
        title: mediaKind === "videos" ? t("empty.noVideos") : t("empty.noGroups"),
        description:
          mediaKind === "videos"
            ? t("empty.noVideosInSource")
            : activeSourceIsRemovable
              ? t("empty.noGroupsInRemovable")
              : t("empty.noGroupsInSource"),
      };
    }
    return {
      title: t("empty.waiting"),
      description: t("empty.waitingDescription"),
    };
  }, [
    activeSourceIsManual,
    activeSourceIsRemovable,
    hasSource,
    mediaKind,
    rootIsAvailable,
    rootPath,
    scanProgressText,
    scanning,
    sourceName,
    sourceWasScanned,
    t,
  ]);
}
