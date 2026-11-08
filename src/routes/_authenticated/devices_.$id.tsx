import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDevice, renameDevice, sendCommand } from "@/lib/devices.functions";
import { isOnline, timeAgo } from "@/lib/time";

const deviceQuery = (id: string) =>
  queryOptions({ queryKey: ["device", id], queryFn: () => getDevice({ data: { id } }), refetchInterval: 3000 });

export const Route = createFileRoute("/_authenticated/devices_/$id")({
  head: () => ({ meta: [{ title: "Console — termux.hub" }, { name: "description", content: "Send commands to your device." }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(deviceQuery(params.id)),
  component: ConsolePage,
});

const statusColor: Record<string, string> = {
  queued: "text-muted-foreground",
  running: "text-warning",
  done: "text-primary",
  failed: "text-destructive",
  rejected: "text-destructive",
  cancelled: "text-muted-foreground",
};

function ConsolePage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(deviceQuery(id));
  const qc = useQueryClient();
  const send = useServerFn(sendCommand);
  const rename = useServerFn(renameDevice);
  const [cmd, setCmd] = useState("");

  const run = useMutation({
    mutationFn: (command: string) => send({ data: { deviceId: id, command } }),
    onSuccess: () => { setCmd(""); qc.invalidateQueries({ queryKey: ["device", id] }); },
    onError: (e) => toast.error(e.message),
  });

  if (!data.device) {
    return (<div className="min-h-screen"><AppHeader /><main className="mx-auto max-w-5xl px-4 py-10">
      Device not found. <Link to="/devices" className="text-primary underline">Back</Link></main></div>);
  }
  const device = data.device;
  const online = isOnline(device.last_seen);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Link to="/devices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> devices
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <h1 className="font-mono text-2xl font-bold">{device.name}</h1>
          <button className="text-xs text-muted-foreground hover:text-foreground" onClick={async () => {
            const n = prompt("Rename device", device.name);
            if (n?.trim()) { await rename({ data: { id, name: n.trim() } }); qc.invalidateQueries(); }
          }}>rename</button>
          <span className="ml-auto flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${online ? "bg-primary shadow-glow" : "bg-muted-foreground/40"}`} />
            {online ? "online" : `last seen ${timeAgo(device.last_seen)}`}
          </span>
        </div>

        <form className="mt-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (cmd.trim()) run.mutate(cmd.trim()); }}>
          <div className="flex flex-1 items-center rounded-md border border-input bg-card px-3 font-mono focus-within:ring-2 focus-within:ring-ring">
            <span className="text-primary">$</span>
            <Input value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="ls -la ~"
              className="border-0 bg-transparent font-mono shadow-none focus-visible:ring-0" />
          </div>
          <Button type="submit" disabled={run.isPending || !cmd.trim()}>Send</Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">Commands wait until your app checks in. Your app can run or reject each one.</p>

        <div className="scanlines mt-6 space-y-4 rounded-lg border border-border bg-card p-4 font-mono text-sm">
          {data.commands.length === 0 && <div className="text-muted-foreground">No commands yet.</div>}
          {data.commands.map((c) => (
            <div key={c.id} className="border-b border-border/50 pb-3 last:border-0">
              <div className="flex gap-3">
                <span className="text-primary">$</span>
                <span className="flex-1 break-all">{c.command}</span>
                <span className={statusColor[c.status]}>{c.status}{c.exit_code != null ? ` (${c.exit_code})` : ""}</span>
                <span className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
              </div>
              {c.output && <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap pl-5 text-muted-foreground">{c.output}</pre>}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
