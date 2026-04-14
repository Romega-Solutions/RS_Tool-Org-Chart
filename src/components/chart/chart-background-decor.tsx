"use client";

export function ChartBackgroundDecor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(255,255,255,0.52), rgba(247,250,252,0.72) 46%, rgba(240,244,248,0.9))",
        }}
      />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0) 46%, rgba(0,0,0,0.08))",
        }}
      />
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          backgroundImage:
            "radial-gradient(circle at top left, rgba(0,112,224,0.045), transparent 26%), radial-gradient(circle at bottom right, rgba(245,158,11,0.04), transparent 28%)",
        }}
      />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          backgroundImage:
            "radial-gradient(circle at top left, rgba(96,165,250,0.05), transparent 24%), radial-gradient(circle at bottom right, rgba(250,204,21,0.035), transparent 28%)",
        }}
      />
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(57,103,151,0.16) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          backgroundPosition: "0 0",
        }}
      />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(148,163,184,0.2) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          backgroundPosition: "0 0",
        }}
      />
      <div
        className="absolute inset-0 opacity-80 dark:hidden"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.95) 0.55px, transparent 0.55px)",
          backgroundSize: "22px 22px",
          backgroundPosition: "11px 11px",
        }}
      />
      <div
        className="absolute inset-0 hidden opacity-85 dark:block"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.08) 0.55px, transparent 0.55px)",
          backgroundSize: "22px 22px",
          backgroundPosition: "11px 11px",
        }}
      />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-rs-primary-500/4 via-white/18 to-transparent dark:from-rs-primary-300/5 dark:via-transparent dark:to-transparent" />
    </div>
  );
}
