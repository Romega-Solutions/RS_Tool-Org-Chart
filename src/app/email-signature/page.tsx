import { redirect } from "next/navigation";
import { buildEmailSignatureUrl } from "@/lib/email-signature-url";

export default function EmailSignatureHandoffPage() {
  redirect(buildEmailSignatureUrl().toString());
}
