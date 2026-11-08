import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "termux.hub — command hub for your Termux apps" },
      { name: "description", content: "Link your Termux apps to your account and send them commands from anywhere." },
      { property: "og:title", content: "termux.hub — command hub for your Termux apps" },
      { property: "og:description", content: "Link your Termux apps to your account and send them commands from anywhere." },
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
          A command hub for your phone.
          <span className="text-primary"> Your app stays in charge.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Link your Termux apps to your account, queue commands from the browser, and watch the output come back.
          Your app decides what runs — and can unlink itself any time.
        </p>
        <div className="mt-10 flex gap-3">
          <Button size="lg" asChild className="shadow-glow"><Link to="/devices">Open dashboard</Link></Button>
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
