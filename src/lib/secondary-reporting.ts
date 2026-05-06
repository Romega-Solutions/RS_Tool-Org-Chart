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
  let metadata: Record<string, unknown> = {};

  if (projectIds) {
    try {
      const parsed = JSON.parse(projectIds) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        metadata = parsed as Record<string, unknown>;
      }
    } catch {
      metadata = {};
    }
  }

  if (reportsToIds.length > 0) {
    metadata.secondaryReportsTo = reportsToIds;
  } else {
    delete metadata.secondaryReportsTo;
  }

  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;
}
