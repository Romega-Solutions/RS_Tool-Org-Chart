"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Settings,
  Network,
  LogOut,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
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
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("orgchart_sidebar") === "collapsed";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("orgchart_sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-60"
      } bg-sidebar border-r border-border flex flex-col h-screen sticky top-0 transition-all duration-300 ease-in-out`}
    >
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between min-h-[60px]">
        {!collapsed && (
          <div className="overflow-hidden">
            <NextImage
              src="/assets/romega-logo.svg"
              alt="Romega Solutions"
              width={120}
              height={32}
              className="dark:invert"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">Org Chart Generator</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 w-8 h-8 cursor-pointer transition-all duration-200 text-muted-foreground hover:text-foreground"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center ${
                collapsed ? "justify-center px-2" : "gap-3 px-3"
              } py-2 rounded-md text-sm cursor-pointer transition-all duration-200 ${
                isActive
                  ? "bg-rs-primary-500/15 text-rs-primary-400 font-medium border-l-2 border-rs-primary-400"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              style={isActive && !collapsed ? { paddingLeft: 10 } : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-border space-y-1">
        {!collapsed && (
          <p className="text-[10px] text-muted-foreground mb-1 px-2 truncate">
            {user?.name} ({user?.role})
          </p>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className={`${
            collapsed ? "w-full justify-center" : "w-full justify-start"
          } text-muted-foreground cursor-pointer transition-all duration-200`}
          onClick={toggle}
          title={collapsed ? (theme === "dark" ? "Light Mode" : "Dark Mode") : undefined}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 shrink-0" />
          ) : (
            <Moon className="w-4 h-4 shrink-0" />
          )}
          {!collapsed && (
            <span className="ml-2">{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          )}
        </Button>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className={`${
            collapsed ? "w-full justify-center" : "w-full justify-start"
          } text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-all duration-200`}
          onClick={logout}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </div>
    </aside>
  );
}
