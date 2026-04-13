"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Building2, Clock, Plus, Network, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Person, Department } from "@/types";

interface Stats {
  activeCount: number;
  departmentCount: number;
  lastUpdated: string | null;
}

export function DashboardStats() {
  const [stats, setStats] = useState<Stats>({
    activeCount: 0,
    departmentCount: 0,
    lastUpdated: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [peopleRes, deptsRes] = await Promise.all([
          fetch("/api/people"),
          fetch("/api/departments"),
        ]);
        const people: Person[] = await peopleRes.json();
        const departments: Department[] = await deptsRes.json();

        const activePeople = people.filter((p) => p.isActive);
        const allUpdates = people
          .map((p) => p.updatedAt)
          .filter(Boolean)
          .sort()
          .reverse();

        setStats({
          activeCount: activePeople.length,
          departmentCount: departments.length,
          lastUpdated: allUpdates[0] || null,
        });
      } catch (err) {
        console.error("Failed to fetch dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

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

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your organizational chart data.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                Active People
              </CardTitle>
              <Users className="w-5 h-5 text-rs-primary-400" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-foreground">
                {stats.activeCount}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                Departments
              </CardTitle>
              <Building2 className="w-5 h-5 text-rs-primary-400" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-foreground">
                {stats.departmentCount}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                Last Updated
              </CardTitle>
              <Clock className="w-5 h-5 text-rs-primary-400" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-32 bg-muted rounded animate-pulse" />
            ) : (
              <p className="text-lg font-semibold text-foreground">
                {formatDate(stats.lastUpdated)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/admin/people">
            <Button
              variant="outline"
              className="w-full justify-between border-border text-foreground hover:bg-muted"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Person
              </span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </Button>
          </Link>

          <Link href="/admin/departments">
            <Button
              variant="outline"
              className="w-full justify-between border-border text-foreground hover:bg-muted"
            >
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Manage Departments
              </span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </Button>
          </Link>

          <Link href="/chart">
            <Button
              variant="outline"
              className="w-full justify-between border-border text-foreground hover:bg-muted"
            >
              <span className="flex items-center gap-2">
                <Network className="w-4 h-4" />
                View Chart
              </span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
