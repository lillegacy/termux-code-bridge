import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authDevice, corsHeaders, json } from "@/lib/device-key.server";

const Body = z.object({
  command_id: z.string().uuid(),
  status: z.enum(["done", "failed", "rejected"]),
  output: z.string().max(200_000).optional(),
  exit_code: z.number().int().optional(),
});

export const Route = createFileRoute("/api/public/device/result")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const auth = await authDevice(request);
        if (!auth) return json({ error: "unauthorized" }, 401);
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "invalid_body" }, 400);
        const { data, error } = await auth.supabaseAdmin
          .from("commands")
          .update({
            status: parsed.data.status,
            output: parsed.data.output ?? null,
            exit_code: parsed.data.exit_code ?? null,
            finished_at: new Date().toISOString(),
          })
          .eq("id", parsed.data.command_id)
          .eq("device_id", auth.device.id)
          .select("id")
          .maybeSingle();
        if (error || !data) return json({ error: "not_found" }, 404);
        return json({ ok: true });
      },
    },
  },
});
