export function isOrgPlaceholder(name: string, title?: string | null) {
  const normalizedName = name.trim().toLowerCase();
  const normalizedTitle = title?.trim().toLowerCase() ?? "";

  return (
    normalizedName.startsWith("tba - ") ||
    normalizedName.endsWith(" team") ||
    normalizedTitle === "team"
  );
}

export function getOrgPlaceholderLabel(name: string, title?: string | null) {
  if (name.trim().toLowerCase().startsWith("tba - ")) {
    return name.replace(/^tba\s*-\s*/i, "");
  }

  if (title?.trim().toLowerCase() === "team") {
    return name.replace(/\s+team$/i, "");
  }

  return name;
}
