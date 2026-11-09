import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Plug, PlugZap, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createGatewayClient, GatewayError, isMixedContent } from "@/lib/gateway-client";

export const Route = createFileRoute("/gateway")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Gateway Console — termux.hub" },
      { name: "description", content: "Connect directly to your Termux SSH Bridge Gateway and run allowlisted commands." },
      { property: "og:title", content: "Gateway Console — termux.hub" },
      { property: "og:description", content: "Direct browser console for the Termux SSH Bridge Gateway." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GatewayPage,
});

type Status = "offline" | "connecting" | "online";
type Entry =
  | { id: number; kind: "result"; command: string; at: string; stdout: string; stderr: string; exitCode?: number | undefined }
  | { id: number; kind: "error"; command: string; at: string; message: string };

const URL_KEY = "gw.url";
const PROFILE_KEY = "gw.profile";
const TOKEN_KEY = "gw.token";
const EXAMPLES = ["whoami", "pwd", "uname -a", "date", "ls -la ~"];

function describe(e: unknown) {
  if (e instanceof GatewayError) return e.message;
  return "Unexpected error.";
}

function GatewayPage() {
  const [url, setUrl] = useState("http://127.0.0.1:8765");
  const [token, setToken] = useState("");
  const [profile, setProfile] = useState("");
  const [remember, setRemember] = useState(false);
  const [status, setStatus] = useState<Status>("offline");
  const [busy, setBusy] = useState<null | "health" | "connect" | "disconnect" | "exec">(null);
  const [banner, setBanner] = useState<{ tone: "error" | "warn"; text: string } | null>(null);
  const [cmd, setCmd] = useState("");
  const [log, setLog] = useState<Entry[]>([]);

  useEffect(() => {
    setUrl(localStorage.getItem(URL_KEY) ?? "http://127.0.0.1:8765");
    setProfile(localStorage.getItem(PROFILE_KEY) ?? "");
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) { setToken(t); setRemember(true); }
  }, []);
  useEffect(() => { localStorage.setItem(URL_KEY, url); }, [url]);
  useEffect(() => { localStorage.setItem(PROFILE_KEY, profile); }, [profile]);
  useEffect(() => {
    if (remember && token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }, [remember, token]);

  const client = useMemo(() => createGatewayClient(url.trim(), token.trim()), [url, token]);
  const mixed = typeof window !== "undefined" && isMixedContent(window.location.protocol, url);
  const ready = !!url.trim() && !!token.trim();

  function handleErr(e: unknown) {
    const msg = describe(e);
    setBanner({ tone: "error", text: msg });
    if (e instanceof GatewayError && (e.kind === "unauthorized" || e.kind === "network")) setStatus("offline");
  }

  async function refresh() {
    setBusy("health"); setBanner(null);
    try {
      const h = await client.health();
      setStatus(h.connected ? "online" : "offline");
    } catch (e) { handleErr(e); }
    finally { setBusy(null); }
  }

  async function connect() {
    if (!profile.trim()) return setBanner({ tone: "warn", text: "Enter a profile name first." });
    setBusy("connect"); setStatus("connecting"); setBanner(null);
    try {
      await client.connect({ profile: profile.trim() });
      const h = await client.health().catch(() => ({ connected: true }));
      setStatus(h.connected === false ? "offline" : "online");
    } catch (e) { setStatus("offline"); handleErr(e); }
    finally { setBusy(null); }
  }

  async function disconnect() {
    setBusy("disconnect"); setBanner(null);
    try { await client.disconnect(); setStatus("offline"); }
    catch (e) { handleErr(e); }
    finally { setBusy(null); }
  }

  async function exec(command: string) {
    if (!command.trim()) return;
    setBusy("exec");
    const at = new Date().toLocaleTimeString();
    const id = Date.now();
    try {
      const r = await client.execute({ command });
      setLog((l) => [{ id, kind: "result", command, at, stdout: r.stdout ?? "", stderr: r.stderr ?? "", exitCode: r.exitCode }, ...l]);
      setCmd("");
    } catch (e) {
      setLog((l) => [{ id, kind: "error", command, at, message: describe(e) }, ...l]);
      if (e instanceof GatewayError && (e.kind === "unauthorized" || e.kind === "network")) handleErr(e);
    } finally { setBusy(null); }
  }

  function copy(e: Entry) {
    const text = e.kind === "error" ? e.message : [e.stdout, e.stderr].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text).then(() => toast.success("Output copied"), () => toast.error("Copy failed"));
  }

  const dot = status === "online" ? "bg-primary shadow-glow" : status === "connecting" ? "bg-warning animate-pulse" : "bg-muted-foreground/40";

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[320px_1fr]">
        <section className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h1 className="font-mono text-lg font-bold">gateway</h1>
            <span className="flex items-center gap-2 font-mono text-xs">
              <span className={`h-2 w-2 rounded-full ${dot}`} /> {status}
            </span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gw-url">Gateway URL</Label>
            <Input id="gw-url" value={url} onChange={(e) => setUrl(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gw-token">Bearer token</Label>
            <Input id="gw-token" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} className="font-mono" />
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="mt-0.5" />
              Remember token on this browser. Anyone with access to this browser could read it. Off by default (kept in memory only).
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gw-profile">Profile name or ID</Label>
            <Input id="gw-profile" value={profile} onChange={(e) => setProfile(e.target.value)} placeholder="my-phone" className="font-mono" />
            <p className="text-xs text-muted-foreground">Your SSH password stays in the app — it's never asked for here.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {status === "online" ? (
              <Button variant="outline" onClick={disconnect} disabled={!!busy}>
                {busy === "disconnect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />} Disconnect
              </Button>
            ) : (
              <Button onClick={connect} disabled={!ready || !!busy}>
                {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />} Connect
              </Button>
            )}
            <Button variant="ghost" onClick={refresh} disabled={!ready || !!busy} aria-label="Refresh status">
              <RefreshCw className={`h-4 w-4 ${busy === "health" ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
          {!ready && <p className="text-xs text-muted-foreground">Enter the gateway URL and token to begin.</p>}
          {mixed && (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
              This page is HTTPS but the gateway is plain HTTP, so your browser will block it. Use an HTTPS reverse proxy/tunnel, or open this dashboard locally and point it at <code className="font-mono">http://127.0.0.1:8765</code> via an SSH tunnel.
            </div>
          )}
          {banner && (
            <div role="alert" className={`flex gap-2 rounded-md border p-3 text-xs ${banner.tone === "error" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-warning/40 bg-warning/10 text-warning"}`}>
              <ShieldAlert className="h-4 w-4 shrink-0" /> {banner.text}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); exec(cmd.trim()); }}>
            <div className="flex flex-1 items-center rounded-md border border-input bg-card px-3 font-mono focus-within:ring-2 focus-within:ring-ring">
              <span className="text-primary">$</span>
              <Input value={cmd} onChange={(e) => setCmd(e.target.value)} disabled={status !== "online"}
                placeholder={status === "online" ? "whoami" : "connect first"} aria-label="Command"
                className="border-0 bg-transparent font-mono shadow-none focus-visible:ring-0" />
            </div>
            <Button type="submit" disabled={status !== "online" || !cmd.trim() || busy === "exec"}>
              {busy === "exec" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run"}
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((c) => (
              <button key={c} type="button" disabled={status !== "online" || !!busy} onClick={() => exec(c)}
                className="rounded border border-border px-2 py-1 font-mono text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground disabled:opacity-40">{c}</button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">The gateway enforces its own command allowlist — commands outside it will be refused.</p>

          <div className="scanlines min-h-64 space-y-4 rounded-lg border border-border bg-card p-4 font-mono text-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>output</span>
              {log.length > 0 && <button onClick={() => setLog([])} className="flex items-center gap-1 hover:text-foreground"><Trash2 className="h-3 w-3" /> clear</button>}
            </div>
            {log.length === 0 && (
              <div className="text-muted-foreground">{status === "online" ? "No commands run yet." : "Disconnected — connect to a profile to run commands."}</div>
            )}
            {log.map((e) => (
              <div key={e.id} className="border-b border-border/50 pb-3 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-primary">$</span>
                  <span className="flex-1 break-all">{e.command}</span>
                  {e.kind === "result"
                    ? <span className={e.exitCode === 0 ? "text-primary" : "text-destructive"}>exit {e.exitCode ?? "?"}</span>
                    : <span className="text-destructive">error</span>}
                  <span className="text-xs text-muted-foreground">{e.at}</span>
                  <button onClick={() => copy(e)} aria-label="Copy output" className="text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
                </div>
                {e.kind === "error" && <pre className="mt-2 whitespace-pre-wrap pl-5 text-destructive">{e.message}</pre>}
                {e.kind === "result" && e.stdout && <pre className="mt-2 max-h-80 overflow-auto whitespace-pre pl-5">{e.stdout}</pre>}
                {e.kind === "result" && e.stderr && <pre className="mt-2 max-h-80 overflow-auto whitespace-pre border-l-2 border-destructive/50 pl-4 text-destructive/90">{e.stderr}</pre>}
                {e.kind === "result" && !e.stdout && !e.stderr && <div className="mt-2 pl-5 text-xs text-muted-foreground">(no output)</div>}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
