import { createFileRoute } from "@tanstack/react-router";
import { authDevice, corsHeaders, json } from "@/lib/device-key.server";

export const Route = createFileRoute("/api/public/device/poll")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => {
        const auth = await authDevice(request);
        if (!auth) return json({ error: "unauthorized" }, 401);
        const { device, supabaseAdmin } = auth;
        const { data } = await supabaseAdmin
          .from("commands")
          .select("id, command, created_at")
          .eq("device_id", device.id)
          .eq("status", "queued")
          .order("created_at", { ascending: true })
          .limit(10);
        const cmds = data ?? [];
        if (cmds.length) {
          await supabaseAdmin
            .from("commands")
            .update({ status: "running" })
            .in("id", cmds.map((c) => c.id))
            .eq("status", "queued");
        }
        return json({ commands: cmds });
      },
    },
  },
});
