"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props { value: string; onChange: (value: string) => void; }

export function ViewSwitcher({ value, onChange }: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-44 h-8 text-xs bg-transparent border-none">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="top-down">Top-Down Tree</SelectItem>
        <SelectItem value="horizontal">Horizontal Tree</SelectItem>
        <SelectItem value="grid">Department Grid</SelectItem>
        <SelectItem value="collapsible">Collapsible Tree</SelectItem>
      </SelectContent>
    </Select>
  );
}
