import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plug, PlugZap, RefreshCw, ShieldAlert } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDevice, renameDevice, sendCommand } from "@/lib/devices.functions";
import { isOnline, timeAgo } from "@/lib/time";
import { isMixedContent } from "@/lib/gateway-client";
import {
  type BridgeSessionState,
  type BridgeSettings,
  createBridgeClient,
  describeBridgeError,
  loadBridgeSettings,
} from "@/lib/bridge";

const deviceQuery = (id: string) =>
  queryOptions({
    queryKey: ["device", id],
    queryFn: () => getDevice({ data: { id } }),
    refetchInterval: 3000,
  });

export const Route = createFileRoute("/_authenticated/devices_/$id")({
  head: () => ({
    meta: [
      { title: "Console — termux.hub" },
      { name: "description", content: "Send commands to your device." },
    ],
  }),
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

interface BridgeLogEntry {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  at: string;
}

function ConsolePage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(deviceQuery(id));
  const qc = useQueryClient();
  const send = useServerFn(sendCommand);
  const rename = useServerFn(renameDevice);
  const [cmd, setCmd] = useState("");
  const [bridgeCmd, setBridgeCmd] = useState("");
  const [settings, setSettings] = useState<BridgeSettings | null>(null);
  const [session, setSession] = useState<BridgeSessionState | null>(null);
  const [bridgeError, setBridgeError] = useState("");
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const [bridgeLog, setBridgeLog] = useState<BridgeLogEntry[]>([]);
  const [mixedContent, setMixedContent] = useState(false);

  useEffect(() => {
    setSettings(loadBridgeSettings(id));
  }, [id]);

  useEffect(() => {
    if (!settings) return;
    setMixedContent(isMixedContent(window.location.protocol, settings.url));
  }, [settings]);

  useEffect(() => {
    if (!settings) return;
    let cancelled = false;
    let timer: number | undefined;
    const client = createBridgeClient(settings);
    const poll = async () => {
      let idle = true;
      try {
        const result = await client.status();
        if (cancelled) return;
        setSession(result.session ?? null);
        idle = result.session?.idle ?? true;
        setBridgeError("");
      } catch (error) {
        if (!cancelled) setBridgeError(describeBridgeError(error));
      }
      if (!cancelled) {
        timer = window.setTimeout(poll, (idle ? 30 : 5) * 1000);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [settings]);

  const run = useMutation({
    mutationFn: (command: string) => send({ data: { deviceId: id, command } }),
    onSuccess: () => {
      setCmd("");
      qc.invalidateQueries({ queryKey: ["device", id] });
    },
    onError: (e) => toast.error(e.message),
  });

  async function reconnectBridge() {
    if (!settings) return;
    setBridgeBusy(true);
    try {
      const client = createBridgeClient(settings);
      const result = await client.connect();
      if (!result.connected) throw new Error(result.message ?? "SSH connection failed.");
      setSession(result.session ?? null);
      setBridgeError("");
      toast.success("Bridge connected");
    } catch (error) {
      const message = describeBridgeError(error);
      setBridgeError(message);
      toast.error(message);
    } finally {
      setBridgeBusy(false);
    }
  }

  async function runBridgeCommand() {
    if (!settings || !bridgeCmd.trim()) return;
    setBridgeBusy(true);
    try {
      const client = createBridgeClient(settings);
      const result = await client.execute(bridgeCmd.trim());
      setSession(result.session ?? null);
      setBridgeLog((log) => [
        {
          command: bridgeCmd.trim(),
          stdout: result.stdout ?? "",
          stderr: result.stderr ?? "",
          exitCode: result.exitCode ?? 0,
          at: new Date().toLocaleTimeString(),
        },
        ...log,
      ]);
      setBridgeCmd("");
      setBridgeError("");
    } catch (error) {
      const message = describeBridgeError(error);
      setBridgeError(message);
      toast.error(message);
    } finally {
      setBridgeBusy(false);
    }
  }

  async function disconnectBridge() {
    if (!settings) return;
    setBridgeBusy(true);
    try {
      await createBridgeClient(settings).disconnect();
      setSession(null);
      toast.success("Bridge disconnected");
    } catch (error) {
      toast.error(describeBridgeError(error));
    } finally {
      setBridgeBusy(false);
    }
  }

  if (!data.device) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-5xl px-4 py-10">
          Device not found.{" "}
          <Link to="/devices" className="text-primary underline">
            Back
          </Link>
        </main>
      </div>
    );
  }
  const device = data.device;
  const online = isOnline(device.last_seen);
  const bridgeConnected = session != null;
  const bridgeIdle = session?.idle === true;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Link
          to="/devices"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> devices
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <h1 className="font-mono text-2xl font-bold">{device.name}</h1>
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={async () => {
              const n = prompt("Rename device", device.name);
              if (n?.trim()) {
                await rename({ data: { id, name: n.trim() } });
                qc.invalidateQueries();
              }
            }}
          >
            rename
          </button>
          <span className="ml-auto flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span
              className={`h-2 w-2 rounded-full ${online ? "bg-primary shadow-glow" : "bg-muted-foreground/40"}`}
            />
            {online ? "online" : `last seen ${timeAgo(device.last_seen)}`}
          </span>
        </div>

        {settings ? (
          <section className="mt-6 rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <PlugZap className="h-4 w-4 text-primary" />
              <span className="font-mono text-sm">direct bridge</span>
              <span
                className={`font-mono text-xs ${bridgeConnected ? "text-primary" : "text-muted-foreground"}`}
              >
                {bridgeConnected
                  ? bridgeIdle
                    ? `idle ${session?.idleSeconds ?? 0}s · heartbeat ${session?.heartbeatSeconds ?? 30}s`
                    : `connected ${session?.connectedForSeconds ?? 0}s · ${session?.commandCount ?? 0} commands`
                  : "not connected"}
              </span>
              <span className="ml-auto flex gap-2">
                {bridgeConnected ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={reconnectBridge}
                      disabled={bridgeBusy}
                    >
                      <RefreshCw className="h-4 w-4" /> Reconnect
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={disconnectBridge}
                      disabled={bridgeBusy}
                    >
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={reconnectBridge} disabled={bridgeBusy}>
                    {bridgeBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plug className="h-4 w-4" />
                    )}
                    Connect
                  </Button>
                )}
              </span>
            </div>

            {mixedContent && (
              <p className="mt-3 flex items-center gap-2 text-xs text-destructive">
                <ShieldAlert className="h-4 w-4" />
                This page is HTTPS and the gateway is HTTP on a non-local host — the browser will
                block the request. Use a tunnel or open the webapp over HTTP on the LAN.
              </p>
            )}
            {bridgeError && (
              <p className="mt-3 flex items-center gap-2 text-xs text-destructive">
                <ShieldAlert className="h-4 w-4" /> {bridgeError}
              </p>
            )}

            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void runBridgeCommand();
              }}
            >
              <div className="flex flex-1 items-center rounded-md border border-input bg-background px-3 font-mono focus-within:ring-2 focus-within:ring-ring">
                <span className="text-primary">$</span>
                <Input
                  value={bridgeCmd}
                  onChange={(e) => setBridgeCmd(e.target.value)}
                  placeholder="tmux ls"
                  className="border-0 bg-transparent font-mono shadow-none focus-visible:ring-0"
                />
              </div>
              <Button type="submit" disabled={bridgeBusy || !bridgeConnected || !bridgeCmd.trim()}>
                {bridgeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run"}
              </Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">
              Runs immediately over the phone&apos;s open SSH session. After 30s idle the phone
              eases its heartbeat to 30s; after 30 minutes it disconnects automatically.
            </p>

            <div className="scanlines mt-4 space-y-4 rounded-lg border border-border bg-background p-4 font-mono text-sm">
              {bridgeLog.length === 0 && (
                <div className="text-muted-foreground">No bridge commands yet.</div>
              )}
              {bridgeLog.map((entry, index) => (
                <div
                  key={`${entry.at}-${index}`}
                  className="border-b border-border/50 pb-3 last:border-0"
                >
                  <div className="flex gap-3">
                    <span className="text-primary">$</span>
                    <span className="flex-1 break-all">{entry.command}</span>
                    <span className={entry.exitCode === 0 ? "text-primary" : "text-destructive"}>
                      {entry.exitCode}
                    </span>
                    <span className="text-xs text-muted-foreground">{entry.at}</span>
                  </div>
                  {(entry.stdout || entry.stderr) && (
                    <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap pl-5 text-muted-foreground">
                      {entry.stdout}
                      {entry.stderr}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="mt-6 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            No bridge configured for this device. Use{" "}
            <Link to="/devices" className="text-primary underline">
              Connect
            </Link>{" "}
            on the devices page to point the browser at the phone&apos;s Gateway API.
          </section>
        )}

        <h2 className="mt-10 font-mono text-sm uppercase tracking-wide text-muted-foreground">
          cloud queue (fallback)
        </h2>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (cmd.trim()) run.mutate(cmd.trim());
          }}
        >
          <div className="flex flex-1 items-center rounded-md border border-input bg-card px-3 font-mono focus-within:ring-2 focus-within:ring-ring">
            <span className="text-primary">$</span>
            <Input
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              placeholder="ls -la ~"
              className="border-0 bg-transparent font-mono shadow-none focus-visible:ring-0"
            />
          </div>
          <Button type="submit" disabled={run.isPending || !cmd.trim()}>
            Send
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Commands wait until your app checks in. Your app can run or reject each one.
        </p>

        <div className="scanlines mt-6 space-y-4 rounded-lg border border-border bg-card p-4 font-mono text-sm">
          {data.commands.length === 0 && (
            <div className="text-muted-foreground">No commands yet.</div>
          )}
          {data.commands.map((c) => (
            <div key={c.id} className="border-b border-border/50 pb-3 last:border-0">
              <div className="flex gap-3">
                <span className="text-primary">$</span>
                <span className="flex-1 break-all">{c.command}</span>
                <span className={statusColor[c.status]}>
                  {c.status}
                  {c.exit_code != null ? ` (${c.exit_code})` : ""}
                </span>
                <span className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
              </div>
              {c.output && (
                <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap pl-5 text-muted-foreground">
                  {c.output}
                </pre>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
