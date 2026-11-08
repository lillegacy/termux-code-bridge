import { createFileRoute } from "@tanstack/react-router";
import { authDevice, corsHeaders, json } from "@/lib/device-key.server";

export const Route = createFileRoute("/api/public/device/unlink")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const auth = await authDevice(request);
        if (!auth) return json({ error: "unauthorized" }, 401);
        // Deleting the device revokes its key and removes its commands.
        await auth.supabaseAdmin.from("devices").delete().eq("id", auth.device.id);
        return json({ ok: true });
      },
    },
  },
});
