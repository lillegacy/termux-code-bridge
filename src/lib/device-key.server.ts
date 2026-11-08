export async function hashKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function newDeviceKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return "tdk_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

export function bearer(request: Request): string | null {
  const h = request.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(tdk_[a-f0-9]{64})$/i);
  return m ? m[1] : null;
}

/** Resolve the device for a request's device key, or null. Updates last_seen. */
export async function authDevice(request: Request) {
  const key = bearer(request);
  if (!key) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("devices")
    .select("id, owner_id, name")
    .eq("key_hash", await hashKey(key))
    .maybeSingle();
  if (!data) return null;
  await supabaseAdmin.from("devices").update({ last_seen: new Date().toISOString() }).eq("id", data.id);
  return { device: data, supabaseAdmin };
}
