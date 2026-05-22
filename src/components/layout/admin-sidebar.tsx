"use client";
import { assetPath } from "@/lib/paths";
import { useState, useEffect } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Settings,
  Network,
  LifeBuoy,
  LogOut,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  UserPlus,
  FolderPlus,
  Upload,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Image,
  KeyRound,
  Workflow,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { PersonForm } from "@/components/admin/person-form";
import { DepartmentForm } from "@/components/admin/department-form";
import { CsvImport } from "@/components/admin/csv-import";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExportQuickAction } from "@/components/export/export-quick-action";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

function SidebarTooltip({
  label,
  show,
  children,
}: {
  label: string;
  show: boolean;
  children: React.ReactElement;
}) {
  if (!show) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children}></TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chart", label: "Chart", icon: Network },
  { href: "/admin/team", label: "Team", icon: Users },
  { href: "/admin/photos", label: "Photos", icon: Image },
  { href: "/admin/tools", label: "Tools", icon: Workflow },
  { href: "/admin/audit", label: "Audit Log", icon: ClipboardList },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/accessibility", label: "Accessibility & Support", icon: LifeBuoy },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isEditor } = useAuth();
  const { theme, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("orgchart_sidebar") === "collapsed";
    }
    return false;
  });
  const [importOpen, setImportOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("orgchart_quick_actions") !== "closed";
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem("orgchart_quick_actions", quickActionsOpen ? "open" : "closed");
  }, [quickActionsOpen]);

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
      <div className="p-3 border-b border-border flex items-start justify-between min-h-[60px]">
        {!collapsed && (
          <div className="overflow-hidden">
            <NextImage
              src={assetPath("/assets/romega-logo.svg")}
              alt="Romega Solutions"
              width={180}
              height={50}
              loading="eager"
              className="dark:invert dark:brightness-[0.9] dark:saturate-[1.3]"
              style={{ width: "180px", height: "auto" }}
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">Org Chart Generator</p>
          </div>
        )}
        <SidebarTooltip label={collapsed ? "Expand sidebar" : "Collapse sidebar"} show={collapsed}>
          <Button
            variant="ghost"
            size="icon"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="shrink-0 w-8 h-8 cursor-pointer transition-all duration-200 text-muted-foreground hover:text-foreground"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </Button>
        </SidebarTooltip>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <SidebarTooltip key={item.href} label={item.label} show={collapsed}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center ${
                  collapsed ? "justify-center px-2" : "gap-3 px-3 border-l-2"
                } py-2 rounded-md text-sm cursor-pointer transition-all duration-200 ${
                  isActive
                    ? "bg-rs-primary-500/15 text-rs-primary-400 font-medium border-rs-primary-400"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground border-transparent"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            </SidebarTooltip>
          );
        })}
      </nav>

      {/* Quick Actions */}
      {isEditor && (
        <div className="p-2 border-t border-border space-y-1">
          {!collapsed ? (
            <button
              onClick={() => setQuickActionsOpen(!quickActionsOpen)}
              aria-expanded={quickActionsOpen}
              aria-controls="sidebar-quick-actions"
              className="flex items-center justify-between w-full text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 mb-1 hover:text-foreground cursor-pointer transition-colors duration-200"
            >
              <span>Quick Actions</span>
              <span className="flex items-center gap-1">
                <span className="text-[9px] normal-case tracking-normal opacity-70">
                  {quickActionsOpen ? "Hide" : "Show"}
                </span>
                {quickActionsOpen ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </span>
            </button>
          ) : (
            <SidebarTooltip label={quickActionsOpen ? "Hide Quick Actions" : "Show Quick Actions"} show={true}>
              <button
                onClick={() => setQuickActionsOpen(!quickActionsOpen)}
                aria-label={quickActionsOpen ? "Hide quick actions" : "Show quick actions"}
                aria-expanded={quickActionsOpen}
                aria-controls="sidebar-quick-actions"
                className="w-full flex justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors duration-200 py-1"
              >
                {quickActionsOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            </SidebarTooltip>
          )}
          {quickActionsOpen && <div id="sidebar-quick-actions" className="space-y-1"><PersonForm
            onSave={() => router.refresh()}
            trigger={
              <SidebarTooltip label="Add Person" show={collapsed}>
                <Button
                  variant="ghost"
                  size={collapsed ? "icon" : "sm"}
                  className={`${
                    collapsed ? "w-full justify-center" : "w-full justify-start"
                  } text-muted-foreground hover:text-rs-primary-400 hover:bg-rs-primary-500/10 cursor-pointer transition-all duration-200`}
                >
                  <UserPlus className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="ml-2">Add Person</span>}
                </Button>
              </SidebarTooltip>
            }
          />
          <DepartmentForm
            onSave={() => router.refresh()}
            trigger={
              <SidebarTooltip label="Add Department" show={collapsed}>
                <Button
                  variant="ghost"
                  size={collapsed ? "icon" : "sm"}
                  className={`${
                    collapsed ? "w-full justify-center" : "w-full justify-start"
                  } text-muted-foreground hover:text-rs-accent-400 hover:bg-rs-accent-500/10 cursor-pointer transition-all duration-200`}
                >
                  <FolderPlus className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="ml-2">Add Department</span>}
                </Button>
              </SidebarTooltip>
            }
          />
          <SidebarTooltip label="Import CSV" show={collapsed}>
            <Button
              variant="ghost"
              size={collapsed ? "icon" : "sm"}
              className={`${
                collapsed ? "w-full justify-center" : "w-full justify-start"
              } text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer transition-all duration-200`}
              onClick={() => setImportOpen(true)}
            >
              <Upload className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="ml-2">Import CSV</span>}
            </Button>
          </SidebarTooltip>
          <ExportQuickAction collapsed={collapsed} />
          </div>}
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Import People from CSV</DialogTitle>
              </DialogHeader>
              <CsvImport compact onComplete={() => { router.refresh(); }} />
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Footer */}
      <div className="p-2 border-t border-border space-y-1">
        {!collapsed && (
          <p className="text-[10px] text-muted-foreground mb-1 px-2 truncate">
            {user?.name} ({user?.role})
          </p>
        )}
        <SidebarTooltip label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"} show={collapsed}>
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            className={`${
              collapsed ? "w-full justify-center" : "w-full justify-start"
            } text-muted-foreground cursor-pointer transition-all duration-200`}
            onClick={toggle}
          >
            {theme === "dark" ? (
              <Moon className="w-4 h-4 shrink-0" />
            ) : (
              <Sun className="w-4 h-4 shrink-0" />
            )}
            {!collapsed && (
              <span className="ml-2">{theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
            )}
          </Button>
        </SidebarTooltip>
        <SidebarTooltip label="Change Password" show={collapsed}>
          <Link
            href="/account"
            className={`flex items-center ${
              collapsed ? "justify-center px-2" : "gap-3 px-3"
            } py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-all duration-200`}
          >
            <KeyRound className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Change Password</span>}
          </Link>
        </SidebarTooltip>
        <SidebarTooltip label="Sign Out" show={collapsed}>
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            className={`${
              collapsed ? "w-full justify-center" : "w-full justify-start"
            } text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-all duration-200`}
            onClick={logout}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="ml-2">Sign Out</span>}
          </Button>
        </SidebarTooltip>
      </div>
    </aside>
  );
}
