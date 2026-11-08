import { describe, expect, it, vi } from "vitest";

import { createGatewayClient, requestGateway } from "@/lib/gateway-client";

describe("gateway client", () => {
  it("adds the auth header and returns JSON from the gateway", async () => {
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, connected: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    global.fetch = fetchMock as typeof fetch;

    try {
      const result = await requestGateway<{ ok: boolean; connected: boolean }>(
        "https://gateway.internal",
        "/health",
        { method: "GET" },
        "secret-token",
      );

      expect(result).toEqual({ ok: true, connected: true });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://gateway.internal/health",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer secret-token",
          }),
        }),
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("builds command helpers for the gateway service", async () => {
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, exitCode: 0, stdout: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    global.fetch = fetchMock as typeof fetch;

    try {
      const client = createGatewayClient("https://gateway.internal", "token-123");
      const result = await client.execute({ command: "echo ok" });

      expect(result).toEqual({ ok: true, exitCode: 0, stdout: "ok" });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://gateway.internal/execute",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer token-123",
          }),
        }),
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});
