import { headers } from "next/headers";
import { InternalToolsDashboard } from "@/components/admin/internal-tools-dashboard";
import { getN8nWorkflowReadiness } from "@/lib/automation/live-n8n-status";
import { getInternalToolsStatus } from "@/lib/automation/tool-status";

export const dynamic = "force-dynamic";

export default async function InternalToolsPage() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const [status, workflows] = await Promise.all([
    getInternalToolsStatus(`${protocol}://${host}/api/tools/status`),
    getN8nWorkflowReadiness(),
  ]);

  return <InternalToolsDashboard status={status} workflows={workflows} />;
}
