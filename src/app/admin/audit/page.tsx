"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";

type AuditEntry = {
  id: number;
  timestamp: string;
  action: string;
  entityType: string;
  entityId: number | null;
  entityName: string | null;
  actor: string | null;
  changes: string | null;
};

const ACTION_BADGE_STYLES: Record<string, string> = {
  created: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30",
  updated: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  deleted: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  activated: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  deactivated: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
};

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_BADGE_STYLES[action] ?? "bg-muted text-muted-foreground border-border";
  return (
    <Badge
      variant="outline"
      className={`capitalize text-xs font-medium ${style}`}
    >
      {action}
    </Badge>
  );
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts;
  }
}

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  async function fetchAuditLog(p = page) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/audit?limit=${PAGE_SIZE}&page=${p}`);
      if (!res.ok) throw new Error(`Failed to fetch audit log (${res.status})`);
      const data = await res.json();
      // Support both paginated and legacy response formats
      if (Array.isArray(data)) {
        setEntries(data);
        setTotalPages(1);
        setTotal(data.length);
      } else {
        setEntries(data.entries);
        setTotalPages(data.totalPages);
        setTotal(data.total);
        setPage(data.page);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAuditLog(page);
  }, [page]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-xl font-bold"
            style={{ fontFamily: "Merriweather, serif" }}
          >
            Audit Log
          </h1>
          <p className="text-sm text-muted-foreground">
            Track all changes made to people and departments.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchAuditLog()}
          disabled={loading}
          className="gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Change History</CardTitle>
          </div>
          <CardDescription>
            Showing {entries.length} of {total} entries{totalPages > 1 ? ` (page ${page} of ${totalPages})` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="px-6 py-8 text-center text-sm text-destructive">
              {error}
            </div>
          ) : loading ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              Loading audit log...
            </div>
          ) : entries.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              No audit entries found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Timestamp</TableHead>
                  <TableHead className="w-32">Action</TableHead>
                  <TableHead className="w-28">Entity Type</TableHead>
                  <TableHead>Entity Name</TableHead>
                  <TableHead className="w-28">Actor</TableHead>
                  <TableHead className="w-40">Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(entry.timestamp)}
                    </TableCell>
                    <TableCell>
                      <ActionBadge action={entry.action} />
                    </TableCell>
                    <TableCell className="text-sm capitalize text-muted-foreground">
                      {entry.entityType}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {entry.entityName ?? (entry.entityId ? `ID ${entry.entityId}` : "—")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.actor ?? "system"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {entry.changes ? (
                        <details className="cursor-pointer">
                          <summary className="text-muted-foreground hover:text-foreground transition-colors select-none">
                            View changes
                          </summary>
                          <pre className="mt-1 p-2 rounded bg-muted text-[10px] leading-relaxed whitespace-pre-wrap break-all max-w-xs overflow-auto">
                            {JSON.stringify(JSON.parse(entry.changes), null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="gap-1 cursor-pointer"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
