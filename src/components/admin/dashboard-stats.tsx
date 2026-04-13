"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Building2,
  Clock,
  UserCheck,
  UserX,
  Network,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { getDeptIcon } from "@/lib/dept-icons";
import type { Person, Department } from "@/types";

interface PersonWithDept extends Person {
  departmentName: string | null;
  departmentColor: string | null;
}

interface DeptStat {
  id: number;
  name: string;
  color: string;
  count: number;
}

interface Stats {
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  departmentCount: number;
  lastUpdated: string | null;
  deptStats: DeptStat[];
  recentPeople: PersonWithDept[];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

function SkeletonLine({ className }: { className: string }) {
  return <div className={`bg-muted rounded animate-pulse ${className}`} />;
}

export function DashboardStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalCount: 0,
    activeCount: 0,
    inactiveCount: 0,
    departmentCount: 0,
    lastUpdated: null,
    deptStats: [],
    recentPeople: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [peopleRes, deptsRes] = await Promise.all([
          fetch("/api/people?includeInactive=true"),
          fetch("/api/departments"),
        ]);
        const people: PersonWithDept[] = await peopleRes.json();
        const departments: Department[] = await deptsRes.json();

        const activePeople = people.filter((p) => p.isActive);
        const inactivePeople = people.filter((p) => !p.isActive);

        // Department breakdown
        const deptMap = new Map<number, DeptStat>();
        for (const dept of departments) {
          deptMap.set(dept.id, {
            id: dept.id,
            name: dept.name,
            color: dept.color || "#6b7280",
            count: 0,
          });
        }
        for (const p of activePeople) {
          const ds = deptMap.get(p.departmentId);
          if (ds) ds.count++;
        }
        const deptStats = Array.from(deptMap.values()).sort(
          (a, b) => b.count - a.count
        );

        // Recent activity — last 5 updated people
        const recentPeople = [...people]
          .filter((p) => p.updatedAt)
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() -
              new Date(a.updatedAt).getTime()
          )
          .slice(0, 5);

        const allUpdates = people
          .map((p) => p.updatedAt)
          .filter(Boolean)
          .sort()
          .reverse();

        setStats({
          totalCount: people.length,
          activeCount: activePeople.length,
          inactiveCount: inactivePeople.length,
          departmentCount: departments.length,
          lastUpdated: allUpdates[0] || null,
          deptStats,
          recentPeople,
        });
      } catch (err) {
        console.error("Failed to fetch dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const maxDeptCount = Math.max(...stats.deptStats.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {getGreeting()}, {user?.name || "Admin"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <Link
          href="/chart"
          className="flex items-center gap-2 text-sm text-rs-primary-400 hover:text-rs-primary-300 transition-colors"
        >
          <Network className="w-4 h-4" />
          View Chart
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total People */}
        <Card className="bg-card border-border hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                Total People
              </CardTitle>
              <div className="w-8 h-8 rounded-lg bg-rs-primary-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-rs-primary-400" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonLine className="h-8 w-16" />
            ) : (
              <p className="text-3xl font-bold text-foreground">
                {stats.totalCount}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Active */}
        <Card className="bg-card border-border hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                Active
              </CardTitle>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <UserCheck className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonLine className="h-8 w-16" />
            ) : (
              <div>
                <p className="text-3xl font-bold text-foreground">
                  {stats.activeCount}
                </p>
                {stats.totalCount > 0 && (
                  <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {Math.round(
                      (stats.activeCount / stats.totalCount) * 100
                    )}
                    % of total
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inactive */}
        <Card className="bg-card border-border hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                Inactive
              </CardTitle>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <UserX className="w-4 h-4 text-amber-400" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonLine className="h-8 w-16" />
            ) : (
              <p className="text-3xl font-bold text-foreground">
                {stats.inactiveCount}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Departments */}
        <Card className="bg-card border-border hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                Departments
              </CardTitle>
              <div className="w-8 h-8 rounded-lg bg-rs-accent-500/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-rs-accent-400" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonLine className="h-8 w-16" />
            ) : (
              <p className="text-3xl font-bold text-foreground">
                {stats.departmentCount}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Department breakdown */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground">
                Department Breakdown
              </CardTitle>
              <Link
                href="/admin/team"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Manage
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2">
                    <SkeletonLine className="h-3 w-24" />
                    <SkeletonLine className="h-2.5 w-full" />
                  </div>
                ))}
              </div>
            ) : stats.deptStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No departments yet. Create one to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {stats.deptStats.map((dept) => {
                  const DeptIcon = getDeptIcon(dept.name);
                  return (
                  <div key={dept.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                          style={{ backgroundColor: dept.color + "20" }}
                        >
                          <DeptIcon
                            className="w-3.5 h-3.5"
                            style={{ color: dept.color }}
                          />
                        </div>
                        <span className="text-sm text-foreground">
                          {dept.name}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {dept.count} {dept.count === 1 ? "person" : "people"}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: `${(dept.count / maxDeptCount) * 100}%`,
                          backgroundColor: dept.color,
                          opacity: 0.8,
                        }}
                      />
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground">
                Recent Activity
              </CardTitle>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {loading ? "..." : formatDate(stats.lastUpdated)}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <SkeletonLine className="w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <SkeletonLine className="h-3 w-28" />
                      <SkeletonLine className="h-2.5 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats.recentPeople.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No activity yet. Add people to see updates here.
              </p>
            ) : (
              <div className="space-y-1">
                {stats.recentPeople.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                      style={{
                        backgroundColor:
                          person.departmentColor || "#6b7280",
                      }}
                    >
                      {person.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {person.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {person.title}
                        {person.departmentName &&
                          ` · ${person.departmentName}`}
                      </p>
                    </div>
                    {/* Time */}
                    <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                      {formatRelative(person.updatedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
