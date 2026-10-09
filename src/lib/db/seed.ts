import { db } from "./client";
import { settings, users } from "./schema";
import { hashSync } from "bcryptjs";
import { createPublicViewLink } from "@/lib/public-view-link";

const DEFAULT_PUBLIC_VIEW_LINK = createPublicViewLink();

const DEFAULT_SETTINGS = [
  { key: "org_name", value: "Romega Solutions" },
  { key: "chart_title", value: "ORGANIZATIONAL CHART" },
  { key: "tagline", value: "Where Top Tech Talent Meets Game-Changing Companies" },
  { key: "logo_url", value: "/assets/romega-logo.svg" },
  { key: "primary_color", value: "#0070E0" },
  { key: "accent_color", value: "#C8850A" },
  { key: "neutral_color", value: "#607A99" },
  { key: "support_email", value: "" },
  { key: "public_view_code", value: DEFAULT_PUBLIC_VIEW_LINK.code },
  { key: "public_view_code_hash", value: DEFAULT_PUBLIC_VIEW_LINK.hash },
  { key: "public_view_expires_at", value: DEFAULT_PUBLIC_VIEW_LINK.expiresAt },
];

const DEFAULT_USERS = [
  { username: "admin", name: "Admin", password: "admin123", role: "editor" as const },
  { username: "editor", name: "Editor", password: "editor123", role: "editor" as const },
  { username: "viewer", name: "Viewer", password: "viewer123", role: "viewer" as const },
  { username: "visitor", name: "Visitor", password: "HelloRomega321", role: "viewer" as const },
];

export function seedSettings() {
  for (const setting of DEFAULT_SETTINGS) {
    db.insert(settings).values(setting).onConflictDoNothing().run();
  }
}

export function seedUsers() {
  for (const u of DEFAULT_USERS) {
    db.insert(users).values({
      username: u.username,
      name: u.name,
      passwordHash: hashSync(u.password, 10),
      role: u.role,
    }).onConflictDoNothing().run();
  }
}

seedSettings();
seedUsers();
