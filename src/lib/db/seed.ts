import { db } from "./client";
import { settings } from "./schema";

const DEFAULT_SETTINGS = [
  { key: "org_name", value: "Romega Solutions" },
  { key: "chart_title", value: "ORGANIZATIONAL CHART" },
  { key: "tagline", value: "Where Top Tech Talent Meets Game-Changing Companies" },
  { key: "logo_url", value: "/assets/romega-logo.svg" },
  { key: "primary_color", value: "#0070E0" },
  { key: "accent_color", value: "#C8850A" },
  { key: "neutral_color", value: "#607A99" },
];

export function seedSettings() {
  for (const setting of DEFAULT_SETTINGS) {
    db.insert(settings).values(setting).onConflictDoNothing().run();
  }
}

seedSettings();
