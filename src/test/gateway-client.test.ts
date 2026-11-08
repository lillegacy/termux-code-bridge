import { describe, expect, it, vi } from "vitest";

import { createGatewayClient, requestGateway } from "@/lib/gateway-client";

describe("gateway client", () => {
  it("adds the bearer token and reads the phone gateway health contract", async () => {
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          status: "ok",
          sshConnected: true,
          sshConnecting: false,
          activeProfile: "default",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    global.fetch = fetchMock as typeof fetch;

    try {
      const result = await requestGateway<{
        ok: boolean;
        status: string;
        sshConnected: boolean;
        activeProfile: string;
      }>(
        "https://gateway.internal",
        "/health",
        { method: "GET" },
        "secret-token",
      );

      expect(result).toEqual({
        ok: true,
        status: "ok",
        sshConnected: true,
        sshConnecting: false,
        activeProfile: "default",
      });
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

  it("sends the stored profile name expected by the phone gateway", async () => {
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, connected: true, profile: "Default Tailscale Termux" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    global.fetch = fetchMock as typeof fetch;

    try {
      const client = createGatewayClient("https://gateway.internal", "token-123");
      const result = await client.connect({ profile: "Default Tailscale Termux" });

      expect(result).toEqual({
        ok: true,
        connected: true,
        profile: "Default Tailscale Termux",
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://gateway.internal/connect",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ profile: "Default Tailscale Termux" }),
          headers: expect.objectContaining({
            Authorization: "Bearer token-123",
          }),
        }),
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("builds command helpers for the phone API contract", async () => {
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, stdout: "ok", stderr: "", exitCode: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    global.fetch = fetchMock as typeof fetch;

    try {
      const client = createGatewayClient("https://gateway.internal", "token-123");
      const result = await client.execute({ command: "echo ok" });

      expect(result).toEqual({ ok: true, stdout: "ok", stderr: "", exitCode: 0 });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://gateway.internal/execute",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ command: "echo ok" }),
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
