import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Linking docs — termux.hub" },
      { name: "description", content: "How your Termux app pairs, checks in, and reports results." },
      { property: "og:title", content: "Linking docs — termux.hub" },
      { property: "og:description", content: "How your Termux app pairs, checks in, and reports results." },
    ],
  }),
  component: Docs,
});

function Block({ title, children }: { title: string; children: string }) {
  return (
    <section className="mt-10">
      <h2 className="font-mono text-lg font-semibold text-primary">{title}</h2>
      <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-card p-4 font-mono text-sm">{children}</pre>
    </section>
  );
}

function Docs() {
  const [base, setBase] = useState("https://your-app.lovable.app");
  useEffect(() => setBase(window.location.origin), []);
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-mono text-2xl font-bold">linking your app</h1>
        <p className="mt-3 text-muted-foreground">
          Your app is always in control: it pulls commands, chooses whether to run them, and can unlink itself at any time.
        </p>
        <Block title="1. Pair (once)">{`curl -X POST ${base}/api/public/device/pair \\
  -H 'Content-Type: application/json' \\
  -d '{"code":"ABC123","name":"Pixel Termux"}'

# → {"device_id":"…","device_key":"tdk_…"}   save device_key securely`}</Block>
        <Block title="2. Check in every few seconds">{`curl ${base}/api/public/device/poll \\
  -H "Authorization: Bearer $DEVICE_KEY"

# → {"commands":[{"id":"…","command":"uname -a"}]}`}</Block>
        <Block title="3. Report result (or reject)">{`curl -X POST ${base}/api/public/device/result \\
  -H "Authorization: Bearer $DEVICE_KEY" \\
  -H 'Content-Type: application/json' \\
  -d '{"command_id":"…","status":"done","output":"…","exit_code":0}'

# status: "done" | "failed" | "rejected"`}</Block>
        <Block title="4. Unlink from the app">{`curl -X POST ${base}/api/public/device/unlink \\
  -H "Authorization: Bearer $DEVICE_KEY"`}</Block>
        <Block title="Minimal bash loop (Termux)">{`while true; do
  curl -s ${base}/api/public/device/poll -H "Authorization: Bearer $DEVICE_KEY" |
  jq -c '.commands[]' | while read -r c; do
    id=$(echo "$c" | jq -r .id); cmd=$(echo "$c" | jq -r .command)
    out=$(bash -c "$cmd" 2>&1); code=$?
    jq -n --arg id "$id" --arg out "$out" --argjson code $code \\
      '{command_id:$id,status:(if $code==0 then "done" else "failed" end),output:$out,exit_code:$code}' |
    curl -s -X POST ${base}/api/public/device/result -H "Authorization: Bearer $DEVICE_KEY" \\
      -H 'Content-Type: application/json' -d @-
  done
  sleep 3
done`}</Block>
      </main>
    </div>
  );
}
