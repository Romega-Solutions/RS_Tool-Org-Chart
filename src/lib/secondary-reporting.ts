export function parseSecondaryReportsTo(projectIds: string | null | undefined): number[] {
  if (!projectIds) return [];

  try {
    const parsed = JSON.parse(projectIds) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "secondaryReportsTo" in parsed &&
      Array.isArray((parsed as { secondaryReportsTo?: unknown }).secondaryReportsTo)
    ) {
      return (parsed as { secondaryReportsTo: unknown[] }).secondaryReportsTo
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);
    }
  } catch {
    return [];
  }

  return [];
}

export function setSecondaryReportsTo(projectIds: string | null | undefined, reportsToIds: number[]) {
  const metadata = parseProjectMetadata(projectIds);

  if (reportsToIds.length > 0) {
    metadata.secondaryReportsTo = reportsToIds;
  } else {
    delete metadata.secondaryReportsTo;
  }

  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;
}

export function getSheetPhotoSource(projectIds: string | null | undefined): string | null {
  const metadata = parseProjectMetadata(projectIds);
  return typeof metadata.sheetPhotoSource === "string" && metadata.sheetPhotoSource
    ? metadata.sheetPhotoSource
    : null;
}

export function setSheetPhotoSource(projectIds: string | null | undefined, source: string | null) {
  const metadata = parseProjectMetadata(projectIds);

  if (source) {
    metadata.sheetPhotoSource = source;
  } else {
    delete metadata.sheetPhotoSource;
  }

  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;
}

function parseProjectMetadata(projectIds: string | null | undefined): Record<string, unknown> {
  if (!projectIds) return {};

  try {
    const parsed = JSON.parse(projectIds) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}
