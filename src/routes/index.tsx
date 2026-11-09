import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "termux.hub — Termux gateway console" },
      { name: "description", content: "Connect a browser to your Termux SSH Bridge gateway or use the separate cloud device dashboard." },
      { property: "og:title", content: "termux.hub — Termux gateway console" },
      { property: "og:description", content: "Connect to your Termux SSH Bridge gateway or manage queued cloud devices." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-24">
        <p className="font-mono text-sm text-primary">$ ./connect --anywhere</p>
        <h1 className="mt-4 max-w-2xl text-5xl font-bold tracking-tight">
          Your Termux gateway,
          <span className="text-primary"> controlled from your browser.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Connect directly to the Termux SSH Bridge app with its gateway URL and bearer token.
          The phone app keeps SSH credentials and enforces the command allowlist.
        </p>
        <div className="mt-10 flex gap-3">
          <Button size="lg" asChild className="shadow-glow"><Link to="/gateway">Open gateway console</Link></Button>
          <Button size="lg" variant="outline" asChild><Link to="/devices">Device dashboard</Link></Button>
          <Button size="lg" variant="outline" asChild><Link to="/docs">How linking works</Link></Button>
        </div>
        <pre className="scanlines mt-16 overflow-x-auto rounded-lg border border-border bg-card p-6 font-mono text-sm text-muted-foreground">
{`[hub]    queued   →  uname -a
[phone]  running  →  uname -a
[phone]  done     ←  Linux localhost 5.10 aarch64 Android
[phone]  rejected ←  rm -rf ~   (blocked by app)`}
        </pre>
      </main>
    </div>
  );
}
