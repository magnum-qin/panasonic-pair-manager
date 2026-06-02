import { useMemo } from "react";
import type { DriveCandidate } from "../types";
import { fileName } from "../utils";

export function useSourceSelection({
  detectedRoots,
  manualAvailabilityValues,
  manualRoots,
  rootPath,
}: {
  detectedRoots: DriveCandidate[];
  manualAvailabilityValues: Array<boolean | undefined>;
  manualRoots: string[];
  rootPath: string;
}) {
  const manualRootSet = useMemo(() => new Set(manualRoots), [manualRoots]);
  const manualAvailability = useMemo(
    () => new Map(manualRoots.map((path, index) => [path, manualAvailabilityValues[index]])),
    [manualAvailabilityValues, manualRoots],
  );
  const activeSourceIsManual = Boolean(rootPath && manualRootSet.has(rootPath));
  const activeSourceIsRemovable = Boolean(
    rootPath && detectedRoots.some((drive) => drive.scanPath === rootPath),
  );
  const selectedDrive = detectedRoots.find((drive) => drive.scanPath === rootPath);
  const sourceName = selectedDrive?.displayName ?? (rootPath ? fileName(rootPath) || rootPath : "");

  return {
    activeSourceIsManual,
    activeSourceIsRemovable,
    manualAvailability,
    manualRootSet,
    selectedDrive,
    sourceName,
  };
}
