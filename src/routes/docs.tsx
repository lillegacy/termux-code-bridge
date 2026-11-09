import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Gateway and device docs — termux.hub" },
      {
        name: "description",
        content: "Connect to the phone gateway or pair a device with the cloud command queue.",
      },
    ],
  }),
  component: Docs,
});

function Block({ title, children }: { title: string; children: string }) {
  return (
    <section className="mt-10">
      <h2 className="font-mono text-lg font-semibold text-primary">{title}</h2>
      <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-card p-4 font-mono text-sm">
        {children}
      </pre>
    </section>
  );
}

function Docs() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-mono text-2xl font-bold">connect to Termux</h1>
        <p className="mt-3 text-muted-foreground">
          Choose how to connect. The direct gateway console talks to the Termux SSH Bridge app on
          your phone. The separate cloud device dashboard uses pairing and a device polling agent.
        </p>

        <section className="mt-10">
          <h2 className="font-mono text-lg font-semibold text-primary">Direct phone gateway</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Open the{" "}
            <Link to="/gateway" className="text-primary underline">
              Gateway console
            </Link>
            , enter the phone gateway URL (default{" "}
            <code className="font-mono">http://127.0.0.1:8765</code>) and the bearer token shown in
            the phone app&apos;s API tab. The console sends the token only to that URL. Remembering
            it in this browser is optional. This is the phone gateway&apos;s API token; it is not
            the cloud device key or an SSH password.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            The console uses the phone app&apos;s authenticated{" "}
            <code className="font-mono">GET /health</code>,{" "}
            <code className="font-mono">POST /connect</code>,{" "}
            <code className="font-mono">POST /execute</code>, and{" "}
            <code className="font-mono">POST /disconnect</code> endpoints. Enter a stored profile
            name to connect; commands remain subject to the allowlist configured in the phone app.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            The default loopback URL works only when this page is open in a browser on the same
            phone as the gateway. A hosted HTTPS page cannot call a remote plain-HTTP gateway from
            the browser. From another device, use an HTTPS tunnel or reverse proxy, or access the
            gateway through an SSH tunnel. The phone gateway binds to loopback by default; enable
            LAN access only on a trusted network.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-mono text-lg font-semibold text-primary">
            Cloud device command queue (separate feature)
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The{" "}
            <Link to="/devices" className="text-primary underline">
              Devices dashboard
            </Link>{" "}
            does not use the phone gateway API. It pairs an agent with a one-time code and queues
            commands for that agent to poll and report. Its one-time code and resulting device key
            are separate credentials and cannot replace the phone gateway API token.
          </p>
        </section>

        <Block title="1. Pair a device with a one-time code">{`curl -X POST /api/public/device/pair \\
  -H 'Content-Type: application/json' \\
  -d '{"code":"ABC123","name":"Pixel Termux"}'

# → {"device_id":"…","device_key":"tdk_…"}   save device_key securely`}</Block>
        <Block title="2. Check in every few seconds">{`curl /api/public/device/poll \\
  -H "Authorization: Bearer <device_key>"

# → {"commands":[{"id":"…","command":"uname -a"}]}`}</Block>
        <Block title="3. Report result (or reject)">{`curl -X POST /api/public/device/result \\
  -H "Authorization: Bearer <device_key>" \\
  -H 'Content-Type: application/json' \\
  -d '{"command_id":"…","status":"done","output":"…","exit_code":0}'

# status: "done" | "failed" | "rejected"`}</Block>
        <Block title="4. Unlink from the app">{`curl -X POST /api/public/device/unlink \\
  -H "Authorization: Bearer <device_key>"`}</Block>
      </main>
    </div>
  );
}
