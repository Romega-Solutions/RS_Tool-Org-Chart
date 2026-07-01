import { ArrowUpRight, Wrench } from "lucide-react";
import { RootUrlNormalizer } from "@/components/tools/root-url-normalizer";
import { toolEntries } from "@/lib/tools-registry";

export const metadata = {
  title: "Romega Tools",
  description: "Romega Solutions internal tools directory",
};

export default function ToolsHomePage() {
  const liveTools = toolEntries.filter((tool) => tool.status === "live");
  const plannedTools = toolEntries.filter((tool) => tool.status === "planned");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <RootUrlNormalizer />
      <section className="border-b border-border bg-card">
        <div className="mx-auto flex min-h-[34vh] max-w-6xl flex-col justify-end gap-5 px-5 py-10 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-normal text-rs-primary-500">
            <span className="flex size-9 items-center justify-center rounded-md bg-rs-primary-500 text-white">
              <Wrench className="size-5" aria-hidden="true" />
            </span>
            Romega Solutions
          </div>
          <div className="max-w-3xl">
            <h1 className="font-heading text-4xl font-bold sm:text-5xl">Internal Tools</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Central access for Romega operations tools, automation endpoints, and shared employee workflows.
            </p>
          </div>
        </div>
      </section>

      <section className={`mx-auto grid max-w-6xl gap-8 px-5 py-8 sm:px-8 lg:px-10 ${plannedTools.length > 0 ? "lg:grid-cols-[1fr_280px]" : ""}`}>
        <div>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-normal text-muted-foreground">Available Tools</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {liveTools.map((tool) => (
              <a
                key={tool.slug}
                href={tool.href}
                className="group rounded-lg border border-border bg-card p-5 transition hover:border-rs-primary-400 hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold">{tool.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{tool.description}</p>
                  </div>
                  <ArrowUpRight className="mt-1 size-5 shrink-0 text-muted-foreground transition group-hover:text-rs-primary-500" aria-hidden="true" />
                </div>
              </a>
            ))}
          </div>
        </div>

        {plannedTools.length > 0 && (
          <aside className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-normal text-muted-foreground">Configured Next</h2>
            <div className="mt-4 space-y-4">
              {plannedTools.map((tool) => (
                <div key={tool.slug} className="border-b border-border pb-4 last:border-0 last:pb-0">
                  <h3 className="font-semibold">{tool.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
                </div>
              ))}
            </div>
          </aside>
        )}
      </section>
    </main>
  );
}
