import Link from "next/link";
import { Mail, ShieldCheck, ExternalLink, CircleAlert } from "lucide-react";
import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function getSupportEmail() {
  try {
    const rows = db.select().from(settings).all();
    const settingsMap: Record<string, string> = {};
    for (const row of rows) settingsMap[row.key] = row.value;
    return settingsMap.support_email?.trim();
  } catch (error) {
    console.error("Failed to load accessibility settings", error);
    return undefined;
  }
}

export default function AccessibilityPage() {
  const supportEmail = getSupportEmail();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Accessibility statement
          </div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Accessibility and support
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Romega Org Chart Generator is being maintained toward WCAG 2.1 AA for
            major web application flows. Accessibility work includes automated
            checks, keyboard testing, and iterative fixes for contrast,
            navigation, form controls, and print/export UX.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Current accessibility scope</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              <li>Web UI target: WCAG 2.1 AA for key interactive flows.</li>
              <li>
                Tested routes include login, read-only chart view, authenticated
                chart view, and print/PDF preview.
              </li>
              <li>
                Exported files may require additional review before external
                distribution, especially if an accessible tagged PDF is required.
              </li>
              <li>
                When reporting an issue, include the page, task, browser, and any
                assistive technology involved so the issue can be reproduced.
              </li>
            </ul>
          </section>

          <aside className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Need help?</h2>
            <div className="mt-4 space-y-4 text-sm text-muted-foreground">
              {supportEmail ? (
                <p className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Contact support at{" "}
                    <a
                      href={`mailto:${supportEmail}`}
                      className="font-medium text-primary underline underline-offset-4"
                    >
                      {supportEmail}
                    </a>
                    .
                  </span>
                </p>
              ) : (
                <p className="flex items-start gap-2">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Support email is not configured for this deployment yet.
                    Contact your deployment administrator for help.
                  </span>
                </p>
              )}

              <p>
                For general guidance on web accessibility standards, see the W3C
                WCAG overview.
              </p>

              <a
                href="https://www.w3.org/WAI/standards-guidelines/wcag/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 font-medium text-primary underline underline-offset-4"
              >
                WCAG overview
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </aside>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/chart"
            className="rounded-lg border border-border bg-card px-4 py-2 font-medium transition-colors hover:bg-muted"
          >
            Back to chart
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-border bg-card px-4 py-2 font-medium transition-colors hover:bg-muted"
          >
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}
