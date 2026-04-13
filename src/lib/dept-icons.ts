import {
  Crown,
  BarChart3,
  Code2,
  UserSearch,
  Megaphone,
  HandCoins,
  Briefcase,
  type LucideIcon,
} from "lucide-react";

const DEPT_ICONS: Record<string, LucideIcon> = {
  executive: Crown,
  "market intelligence": BarChart3,
  technical: Code2,
  "recruitment & onboarding": UserSearch,
  recruitment: UserSearch,
  marketing: Megaphone,
  sales: HandCoins,
};

export function getDeptIcon(name: string): LucideIcon {
  const key = name.toLowerCase();
  for (const [pattern, icon] of Object.entries(DEPT_ICONS)) {
    if (key.includes(pattern)) return icon;
  }
  return Briefcase;
}
