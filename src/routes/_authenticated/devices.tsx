import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Smartphone, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { createPairingCode, listDevices, removeDevice } from "@/lib/devices.functions";
import { isOnline, timeAgo } from "@/lib/time";

const devicesQuery = queryOptions({ queryKey: ["devices"], queryFn: () => listDevices(), refetchInterval: 10_000 });

export const Route = createFileRoute("/_authenticated/devices")({
  head: () => ({ meta: [{ title: "Devices — termux.hub" }, { name: "description", content: "Your linked Termux apps." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(devicesQuery),
  component: DevicesPage,
});

function DevicesPage() {
  const { data: devices } = useSuspenseQuery(devicesQuery);
  const qc = useQueryClient();
  const makeCode = useServerFn(createPairingCode);
  const remove = useServerFn(removeDevice);
  const [code, setCode] = useState<{ code: string; expires_at: string } | null>(null);

  const pair = useMutation({ mutationFn: () => makeCode(), onSuccess: setCode, onError: (e) => toast.error(e.message) });
  const unlink = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["devices"] }); toast.success("Device unlinked"); },
  });

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="font-mono text-2xl font-bold">devices</h1>
          <Button onClick={() => pair.mutate()} disabled={pair.isPending}><Plus className="h-4 w-4" /> Add device</Button>
        </div>

        {devices.length === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
            No devices linked yet. Click <span className="text-foreground">Add device</span> to get a pairing code for your app.
          </div>
        ) : (
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {devices.map((d) => {
              const online = isOnline(d.last_seen);
              return (
                <li key={d.id} className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition hover:border-primary/50">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <Link to="/devices/$id" params={{ id: d.id }} className="min-w-0 flex-1">
                    <div className="truncate font-medium">{d.name}</div>
                    <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                      <span className={`h-2 w-2 rounded-full ${online ? "bg-primary shadow-glow" : "bg-muted-foreground/40"}`} />
                      {online ? "online" : `last seen ${timeAgo(d.last_seen)}`}
                    </div>
                  </Link>
                  <Button size="icon" variant="ghost" aria-label="Unlink device"
                    onClick={() => confirm(`Unlink ${d.name}? Its key will stop working.`) && unlink.mutate(d.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <Dialog open={!!code} onOpenChange={(o) => !o && (setCode(null), qc.invalidateQueries({ queryKey: ["devices"] }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pairing code</DialogTitle>
            <DialogDescription>Enter this in your app within 10 minutes. It works once.</DialogDescription>
          </DialogHeader>
          <div className="scanlines rounded-md border border-border bg-background py-6 text-center font-mono text-4xl tracking-[0.4em] text-primary">
            {code?.code}
          </div>
          <p className="text-sm text-muted-foreground">
            Your app sends it to <code className="font-mono text-foreground">/api/public/device/pair</code> — see <Link to="/docs" className="text-primary underline">Docs</Link>.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
