import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("devices")
      .select("id, name, last_seen, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const createPairingCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    const { data, error } = await context.supabase
      .from("pairing_codes")
      .insert({ code, owner_id: context.userId })
      .select("code, expires_at")
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

export const renameDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("devices").update({ name: data.name }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("devices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDevice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: device } = await context.supabase
      .from("devices")
      .select("id, name, last_seen")
      .eq("id", data.id)
      .maybeSingle();
    const { data: commands } = await context.supabase
      .from("commands")
      .select("id, command, status, output, exit_code, created_at, finished_at")
      .eq("device_id", data.id)
      .order("created_at", { ascending: false })
      .limit(50);
    return { device, commands: commands ?? [] };
  });

export const sendCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ deviceId: z.string().uuid(), command: z.string().trim().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("commands")
      .insert({ device_id: data.deviceId, owner_id: context.userId, command: data.command });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
