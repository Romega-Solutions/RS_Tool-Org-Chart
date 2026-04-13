"use client";
import Link from "next/link";
import NextImage from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Settings, Network, LogOut, Sun, Moon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chart", label: "Chart", icon: Network },
  { href: "/admin/team", label: "Team", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <aside className="w-60 bg-sidebar border-r border-border flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-border">
        <NextImage
          src="/assets/romega-logo.svg"
          alt="Romega Solutions"
          width={140}
          height={36}
          className="mb-1 dark:invert"
        />
        <p className="text-xs text-muted-foreground">Org Chart Generator</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer transition-all duration-200 ${
                isActive
                  ? "bg-rs-primary-500/15 text-rs-primary-400 font-medium border-l-2 border-rs-primary-400 pl-[10px]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}>
              <Icon className="w-4 h-4" />{item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border space-y-1">
        <p className="text-xs text-muted-foreground mb-2">{user?.name} ({user?.role})</p>
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground cursor-pointer transition-all duration-200" onClick={toggle}>
          {theme === "dark" ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-all duration-200" onClick={logout}>
          <LogOut className="w-4 h-4 mr-2" />Sign Out
        </Button>
      </div>
    </aside>
  );
}
