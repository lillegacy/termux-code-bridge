import { describe, expect, it, vi } from "vitest";

import {
  createGatewayClient,
  getGatewayConnectionState,
  requestGateway,
} from "@/lib/gateway-client";

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

  it("uses the phone gateway health and profile-connect contract", async () => {
    const originalFetch = global.fetch;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            status: "ok",
            sshConnected: true,
            sshConnecting: false,
            activeProfile: "default",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            connected: true,
            profile: "Default Tailscale Termux",
          }),
          { status: 200 },
        ),
      );

    global.fetch = fetchMock as typeof fetch;

    try {
      const client = createGatewayClient("http://127.0.0.1:8765", "phone-api-token");
      const health = await client.health();
      const result = await client.connect({
        profile: "Default Tailscale Termux",
      });

      expect(getGatewayConnectionState(health)).toBe("online");
      expect(result.connected).toBe(true);
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "http://127.0.0.1:8765/connect",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ profile: "Default Tailscale Termux" }),
        }),
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("maps the phone gateway connection states", () => {
    expect(
      getGatewayConnectionState({
        ok: true,
        sshConnected: false,
        sshConnecting: true,
      }),
    ).toBe("connecting");
    expect(
      getGatewayConnectionState({
        ok: true,
        sshConnected: false,
        sshConnecting: false,
      }),
    ).toBe("offline");
  });
});
