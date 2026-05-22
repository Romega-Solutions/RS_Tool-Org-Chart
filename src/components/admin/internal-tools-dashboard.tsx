import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  KeyRound,
  ServerCrash,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  N8nWorkflowConfigMode,
  N8nWorkflowReadiness,
  N8nWorkflowStatus,
} from "@/lib/automation/n8n-workflows";
import type { InternalToolStatus, InternalToolStatusValue, InternalToolsStatusResponse } from "@/lib/automation/tool-status";

const statusLabels: Record<InternalToolStatusValue, string> = {
  ready: "Ready",
  degraded: "Degraded",
  offline: "Offline",
  not_configured: "Not configured",
  auth_failed: "Auth failed",
  schema_missing: "Schema missing",
  invalid_response: "Invalid response",
};

const statusStyles: Record<InternalToolStatusValue, string> = {
  ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  degraded: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  offline: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  not_configured: "border-muted-foreground/30 bg-muted text-muted-foreground",
  auth_failed: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  schema_missing: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  invalid_response: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

const workflowStatusLabels: Record<N8nWorkflowStatus, string> = {
  active: "Active",
  config_required: "Config required",
};

const workflowStatusStyles: Record<N8nWorkflowStatus, string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  config_required: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

const configModeLabels: Record<N8nWorkflowConfigMode, string> = {
  stable: "Stable URL",
  temporary_tunnel: "Temporary tunnel",
  placeholder: "Placeholder",
  unknown: "Unknown URL",
};

const configModeStyles: Record<N8nWorkflowConfigMode, string> = {
  stable: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  temporary_tunnel: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  placeholder: "border-muted-foreground/30 bg-muted text-muted-foreground",
  unknown: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

function StatusIcon({ status }: { status: InternalToolStatusValue }) {
  if (status === "ready") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "offline") return <ServerCrash className="h-4 w-4" />;
  if (status === "not_configured") return <CircleSlash className="h-4 w-4" />;
  if (status === "auth_failed") return <KeyRound className="h-4 w-4" />;
  return <AlertTriangle className="h-4 w-4" />;
}

function StatusBadge({ status }: { status: InternalToolStatusValue }) {
  return (
    <Badge variant="outline" className={`gap-1.5 ${statusStyles[status]}`}>
      <StatusIcon status={status} />
      {statusLabels[status]}
    </Badge>
  );
}

function SummaryTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function EventList({ events }: { events: string[] }) {
  if (events.length === 0) {
    return <span className="text-xs text-muted-foreground">None</span>;
  }

  return (
    <div className="flex max-w-[24rem] flex-wrap gap-1.5">
      {events.map((event) => (
        <Badge key={event} variant="outline" className="font-mono text-[11px]">
          {event}
        </Badge>
      ))}
    </div>
  );
}

function ConfigList({ values }: { values: string[] }) {
  if (values.length === 0) {
    return <span className="text-xs text-muted-foreground">Configured</span>;
  }

  return (
    <div className="flex max-w-[24rem] flex-wrap gap-1.5">
      {values.map((value) => (
        <Badge key={value} variant="outline" className="font-mono text-[11px]">
          {value}
        </Badge>
      ))}
    </div>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function ToolRow({ tool }: { tool: InternalToolStatus }) {
  return (
    <TableRow>
      <TableCell>
        <div className="space-y-1">
          <p className="font-medium text-foreground">{tool.displayName}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{tool.sourceTool}</p>
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={tool.status} />
      </TableCell>
      <TableCell>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>Health: {statusLabels[tool.healthStatus]}</p>
          <p>Schema: {statusLabels[tool.schemaStatus]}</p>
          <p>Auth: {tool.authReady ? "Ready" : "Needs key"}</p>
        </div>
      </TableCell>
      <TableCell>
        <EventList events={tool.inboundEvents} />
      </TableCell>
      <TableCell>
        <EventList events={tool.outboundEvents} />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        <div className="space-y-1">
          <p>{formatTime(tool.lastCheckedAt)}</p>
          {tool.error && <p className="max-w-[16rem] whitespace-normal text-[11px] text-muted-foreground">{tool.error}</p>}
        </div>
      </TableCell>
    </TableRow>
  );
}

function WorkflowStatusBadge({ status }: { status: N8nWorkflowStatus }) {
  return (
    <Badge variant="outline" className={`gap-1.5 ${workflowStatusStyles[status]}`}>
      {status === "active" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      {workflowStatusLabels[status]}
    </Badge>
  );
}

function ConfigModeBadge({ mode }: { mode?: N8nWorkflowConfigMode }) {
  if (!mode) {
    return null;
  }

  return (
    <Badge variant="outline" className={`w-fit ${configModeStyles[mode]}`}>
      {configModeLabels[mode]}
    </Badge>
  );
}

function WorkflowRow({ workflow }: { workflow: N8nWorkflowReadiness }) {
  return (
    <TableRow>
      <TableCell>
        <div className="space-y-1">
          <p className="font-medium text-foreground">{workflow.name}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{workflow.workflowId}</p>
        </div>
      </TableCell>
      <TableCell>
        <WorkflowStatusBadge status={workflow.status} />
      </TableCell>
      <TableCell className="font-mono text-[11px] text-muted-foreground">{workflow.webhookPath}</TableCell>
      <TableCell>
        <ConfigList values={workflow.requiredConfig} />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        <div className="space-y-1">
          <p>{workflow.lastEvidence}</p>
          {workflow.lastVerifiedAt && <p>{formatTime(workflow.lastVerifiedAt)}</p>}
          <div className="flex flex-wrap items-center gap-1.5">
            <ConfigModeBadge mode={workflow.configUrlMode} />
            {workflow.configUrlHost && <span className="font-mono text-[11px]">{workflow.configUrlHost}</span>}
          </div>
          <p>
            Source: {workflow.statusSource ?? "static"}
            {workflow.liveError ? ` (${workflow.liveError})` : ""}
          </p>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function InternalToolsDashboard({
  status,
  workflows = [],
}: {
  status: InternalToolsStatusResponse;
  workflows?: N8nWorkflowReadiness[];
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            Internal Tools
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Automation health, schemas, and n8n readiness across Romega internal tools.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
          <Workflow className="h-4 w-4" />
          Checked {formatTime(status.generatedAt)}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="Ready" value={status.summary.ready} icon={CheckCircle2} />
        <SummaryTile label="Degraded" value={status.summary.degraded + status.summary.schemaMissing + status.summary.invalidResponse} icon={AlertTriangle} />
        <SummaryTile label="Offline" value={status.summary.offline} icon={ServerCrash} />
        <SummaryTile label="Not configured" value={status.summary.notConfigured} icon={CircleSlash} />
      </div>

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Tool Readiness</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Read-only status from health endpoints and `/api/automation/schema`.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tool</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Checks</TableHead>
              <TableHead>Inbound events</TableHead>
              <TableHead>Outbound events</TableHead>
              <TableHead>Last checked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {status.tools.map((tool) => (
              <ToolRow key={tool.id} tool={tool} />
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">n8n Workflows</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Server-side n8n status when configured, with static readiness fallback for the imported Romega workflows.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workflow</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Webhook</TableHead>
              <TableHead>Required config</TableHead>
              <TableHead>Evidence and URL mode</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workflows.map((workflow) => (
              <WorkflowRow key={workflow.id} workflow={workflow} />
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
