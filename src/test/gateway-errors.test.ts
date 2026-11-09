import { describe, expect, it, vi } from "vitest";
import { GatewayError, isMixedContent, requestGateway } from "@/lib/gateway-client";

function mockFetch(res: Response | Error) {
  const orig = global.fetch;
  global.fetch = (
    res instanceof Error ? vi.fn().mockRejectedValue(res) : vi.fn().mockResolvedValue(res)
  ) as typeof fetch;
  return () => {
    global.fetch = orig;
  };
}

describe("gateway errors", () => {
  it("401 becomes unauthorized without leaking the token", async () => {
    const restore = mockFetch(
      new Response(JSON.stringify({ error: { code: "unauthorized", message: "bad token" } }), {
        status: 401,
      }),
    );
    try {
      const err = (await requestGateway("http://x", "/health", {}, "tok-SECRET").catch(
        (e: GatewayError) => e,
      )) as GatewayError;
      expect(err).toBeInstanceOf(GatewayError);
      expect(err.kind).toBe("unauthorized");
      expect(err.message).toBe("bad token");
      expect(err.message).not.toContain("tok-SECRET");
    } finally {
      restore();
    }
  });

  it("network failure becomes network error", async () => {
    const restore = mockFetch(new TypeError("Failed to fetch"));
    try {
      const err = (await requestGateway("http://x", "/health").catch(
        (e: GatewayError) => e,
      )) as GatewayError;
      expect(err.kind).toBe("network");
    } finally {
      restore();
    }
  });

  it("nonzero exit with HTTP 200 is a normal result", async () => {
    const restore = mockFetch(
      new Response(JSON.stringify({ exitCode: 2, stdout: "", stderr: "nope" }), { status: 200 }),
    );
    try {
      const r = await requestGateway<{ exitCode: number }>("http://x", "/execute", {
        method: "POST",
      });
      expect(r.exitCode).toBe(2);
    } finally {
      restore();
    }
  });

  it("flags https page calling remote http gateway", () => {
    expect(isMixedContent("https:", "http://192.168.1.5:8765")).toBe(true);
    expect(isMixedContent("https:", "https://gw.example.com")).toBe(false);
  });
});
