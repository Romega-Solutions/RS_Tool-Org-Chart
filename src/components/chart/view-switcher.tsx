"use client";

import {
  ArrowRightLeft,
  LayoutGrid,
  Network,
  type LucideIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ViewMode = "top-down" | "horizontal" | "grid";

interface ViewOption {
  value: ViewMode;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
}

export const VIEW_OPTIONS: ViewOption[] = [
  {
    value: "top-down",
    label: "Top-Down Tree",
    shortLabel: "Top-Down",
    description: "Classic hierarchy from leadership to contributors",
    icon: Network,
  },
  {
    value: "horizontal",
    label: "Horizontal Tree",
    shortLabel: "Horizontal",
    description: "Side-to-side hierarchy for wide org structures",
    icon: ArrowRightLeft,
  },
  {
    value: "grid",
    label: "Department Grid",
    shortLabel: "Grid",
    description: "Department-first cards with faster scanning",
    icon: LayoutGrid,
  },
];

interface Props {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

export function ViewSwitcher({ value, onChange }: Props) {
  const selectedOption =
    VIEW_OPTIONS.find((option) => option.value === value) ?? VIEW_OPTIONS[0];
  const SelectedIcon = selectedOption.icon;

  return (
    <Select value={value} onValueChange={(next) => onChange(next as ViewMode)}>
      <SelectTrigger
        className="h-10 min-w-[200px] rounded-2xl border-border/80 bg-background/85 px-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm hover:bg-background/85 [&_svg]:text-muted-foreground"
        aria-label="Chart view"
      >
        <SelectValue>
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-rs-primary-500/10 text-rs-primary-500 [&_svg]:text-rs-primary-500">
              <SelectedIcon className="size-4" />
            </span>
            <span className="truncate text-[0.8rem] font-semibold leading-none">
              {selectedOption.label}
            </span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-72 rounded-2xl p-1.5">
        {VIEW_OPTIONS.map((option) => {
          const Icon = option.icon;

          return (
            <SelectItem
              key={option.value}
              value={option.value}
              className="min-h-14 rounded-xl py-2 pr-8 pl-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[0.8rem] font-semibold leading-none">
                    {option.label}
                  </div>
                  <div className="mt-1 line-clamp-2 whitespace-normal text-[0.68rem] leading-snug text-muted-foreground">
                    {option.description}
                  </div>
                </div>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
