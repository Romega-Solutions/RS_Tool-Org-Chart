import { headers } from "next/headers";
import { InternalToolsDashboard } from "@/components/admin/internal-tools-dashboard";
import { getInternalToolsStatus } from "@/lib/automation/tool-status";

export const dynamic = "force-dynamic";

export default async function InternalToolsPage() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const status = await getInternalToolsStatus(`${protocol}://${host}/api/tools/status`);

  return <InternalToolsDashboard status={status} />;
}
