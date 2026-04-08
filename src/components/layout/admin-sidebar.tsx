"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Building2, Upload, Settings, Network, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/chart", label: "Chart", icon: Network },
  { href: "/admin/people", label: "People", icon: Users },
  { href: "/admin/departments", label: "Departments", icon: Building2 },
  { href: "/admin/import", label: "Import", icon: Upload },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="w-60 bg-rs-neutral-900 border-r border-rs-neutral-800 flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-rs-neutral-800">
        <h2 className="text-sm font-bold text-rs-primary-400">Romega Solutions</h2>
        <p className="text-xs text-rs-neutral-400">Org Chart</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${isActive ? "bg-rs-primary-500/10 text-rs-primary-400" : "text-rs-neutral-300 hover:bg-rs-neutral-800 hover:text-rs-neutral-100"}`}>
              <Icon className="w-4 h-4" />{item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-rs-neutral-800">
        <p className="text-xs text-rs-neutral-400 mb-2">{user?.name} ({user?.role})</p>
        <Button variant="ghost" size="sm" className="w-full justify-start text-rs-neutral-400" onClick={logout}>
          <LogOut className="w-4 h-4 mr-2" />Sign Out
        </Button>
      </div>
    </aside>
  );
}
