import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { corsHeaders, hashKey, json, newDeviceKey } from "@/lib/device-key.server";

const Body = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/),
  name: z.string().trim().min(1).max(60).optional(),
});

export const Route = createFileRoute("/api/public/device/pair")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "invalid_code" }, 400);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Atomically claim the code
        const { data: code } = await supabaseAdmin
          .from("pairing_codes")
          .update({ used: true })
          .eq("code", parsed.data.code)
          .eq("used", false)
          .gt("expires_at", new Date().toISOString())
          .select("owner_id")
          .maybeSingle();
        if (!code) return json({ error: "invalid_or_expired_code" }, 400);
        const key = newDeviceKey();
        const { data: device, error } = await supabaseAdmin
          .from("devices")
          .insert({
            owner_id: code.owner_id,
            name: parsed.data.name ?? "Termux device",
            key_hash: await hashKey(key),
            last_seen: new Date().toISOString(),
          })
          .select("id, name")
          .single();
        if (error) return json({ error: "pair_failed" }, 500);
        return json({ device_id: device.id, name: device.name, device_key: key });
      },
    },
  },
});
