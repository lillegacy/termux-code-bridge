import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { PlugZap, Plus, Smartphone, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createPairingCode, listDevices, removeDevice } from "@/lib/devices.functions";
import { isOnline, timeAgo } from "@/lib/time";
import {
  createBridgeClient,
  describeBridgeError,
  loadBridgeSettings,
  saveBridgeSettings,
} from "@/lib/bridge";

const devicesQuery = queryOptions({
  queryKey: ["devices"],
  queryFn: () => listDevices(),
  refetchInterval: 10_000,
});

export const Route = createFileRoute("/_authenticated/devices")({
  head: () => ({
    meta: [
      { title: "Devices — termux.hub" },
      { name: "description", content: "Your linked Termux apps." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(devicesQuery),
  component: DevicesPage,
});

const emptyForm = { url: "", token: "", profile: "", pin: "" };

function DevicesPage() {
  const { data: devices } = useSuspenseQuery(devicesQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const makeCode = useServerFn(createPairingCode);
  const remove = useServerFn(removeDevice);
  const [code, setCode] = useState<{ code: string; expires_at: string } | null>(null);
  const [target, setTarget] = useState<(typeof devices)[number] | null>(null);
  const [form, setForm] = useState(emptyForm);

  const pair = useMutation({
    mutationFn: () => makeCode(),
    onSuccess: setCode,
    onError: (e) => toast.error(e.message),
  });
  const unlink = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Device unlinked");
    },
  });

  function openBridge(device: (typeof devices)[number]) {
    const saved = loadBridgeSettings(device.id);
    setForm(
      saved ?? {
        ...emptyForm,
        profile: device.name,
      },
    );
    setTarget(device);
  }

  const connect = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error("No device selected.");
      const settings = {
        url: form.url.trim(),
        token: form.token.trim(),
        profile: form.profile.trim(),
        pin: form.pin.trim(),
      };
      const client = createBridgeClient(settings);
      const result = await client.connect();
      if (!result.connected) {
        throw new Error(result.message ?? "The phone refused the SSH connection.");
      }
      saveBridgeSettings(target.id, settings);
      return target;
    },
    onSuccess: (device) => {
      setTarget(null);
      toast.success(`Bridge connected to ${device.name}`);
      navigate({ to: "/devices/$id", params: { id: device.id } });
    },
    onError: (e) => toast.error(describeBridgeError(e)),
  });

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="font-mono text-2xl font-bold">devices</h1>
          <Button onClick={() => pair.mutate()} disabled={pair.isPending}>
            <Plus className="h-4 w-4" /> Add device
          </Button>
        </div>

        {devices.length === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
            No devices linked yet. Click <span className="text-foreground">Add device</span> to
            generate a one-time code for a cloud command-queue agent.
          </div>
        ) : (
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {devices.map((d) => {
              const online = isOnline(d.last_seen);
              const configured = !!loadBridgeSettings(d.id);
              return (
                <li
                  key={d.id}
                  className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition hover:border-primary/50"
                >
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <Link to="/devices/$id" params={{ id: d.id }} className="min-w-0 flex-1">
                    <div className="truncate font-medium">{d.name}</div>
                    <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                      <span
                        className={`h-2 w-2 rounded-full ${online ? "bg-primary shadow-glow" : "bg-muted-foreground/40"}`}
                      />
                      {online ? "online" : `last seen ${timeAgo(d.last_seen)}`}
                      {configured && <span className="text-primary">· bridge ready</span>}
                    </div>
                  </Link>
                  <Button
                    size="sm"
                    variant={configured ? "default" : "outline"}
                    onClick={() => openBridge(d)}
                    title="Connect directly to the phone's bridge gateway"
                  >
                    <PlugZap className="h-4 w-4" /> Connect
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Unlink device"
                    onClick={() =>
                      confirm(`Unlink ${d.name}? Its key will stop working.`) && unlink.mutate(d.id)
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect to {target?.name}</DialogTitle>
            <DialogDescription>
              The browser connects straight to the phone&apos;s Gateway API. Enable{" "}
              <span className="text-foreground">Allow trusted LAN access</span> in the app, then
              copy its bearer token from the API tab.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground" htmlFor="bridge-url">
                Gateway URL
              </label>
              <Input
                id="bridge-url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="http://192.168.1.20:8765"
                className="font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground" htmlFor="bridge-token">
                Bearer token
              </label>
              <Input
                id="bridge-token"
                value={form.token}
                onChange={(e) => setForm({ ...form, token: e.target.value })}
                placeholder="API tab token"
                className="font-mono"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground" htmlFor="bridge-profile">
                  SSH profile
                </label>
                <Input
                  id="bridge-profile"
                  value={form.profile}
                  onChange={(e) => setForm({ ...form, profile: e.target.value })}
                  placeholder="Default Tailscale Termux"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground" htmlFor="bridge-pin">
                  Bridge PIN (if set)
                </label>
                <Input
                  id="bridge-pin"
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value })}
                  placeholder="1234"
                  inputMode="numeric"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Settings are stored in this browser only. The token and PIN never reach the webapp
              server.
            </p>
            <Button
              className="w-full"
              onClick={() => connect.mutate()}
              disabled={connect.isPending || !form.url.trim() || !form.profile.trim()}
            >
              <PlugZap className="h-4 w-4" />
              {connect.isPending ? "Connecting…" : "Connect bridge"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!code}
        onOpenChange={(o) => !o && (setCode(null), qc.invalidateQueries({ queryKey: ["devices"] }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pairing code</DialogTitle>
            <DialogDescription>
              Use this once within 10 minutes to link an agent to the cloud command queue.
            </DialogDescription>
          </DialogHeader>
          <div className="scanlines rounded-md border border-border bg-background py-6 text-center font-mono text-4xl tracking-[0.4em] text-primary">
            {code?.code}
          </div>
          <p className="text-sm text-muted-foreground">
            The cloud agent submits this code to{" "}
            <code className="font-mono text-foreground">/api/public/device/pair</code>. For direct
            low-latency control, use <span className="text-foreground">Connect</span> on a device
            card instead.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
