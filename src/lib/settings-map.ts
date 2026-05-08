import type { Setting } from "@/types";

const SENSITIVE_SETTING_KEYS = new Set([
  "api_key",
  "public_view_code",
  "public_view_code_hash",
]);

export function settingsRowsToMap(rows: Setting[], includeSensitive = false) {
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (!includeSensitive && SENSITIVE_SETTING_KEYS.has(row.key)) continue;
    map[row.key] = row.value;
  }
  return map;
}
