// Direct on-demand bridge client for the phone's Termux SSH Bridge Gateway.
//
// The browser talks to the phone over the LAN (or Tailscale) using the same
// bearer token as the Gateway console. Settings are kept in localStorage per
// linked device so the Devices page can reconnect quickly.

import { GatewayError, requestGateway } from "./gateway-client";

export interface BridgeSessionState {
  sessionId?: string;
  profile?: string;
  profileId?: string;
  connectedForSeconds?: number;
  idleSeconds?: number;
  idle?: boolean;
  commandCount?: number;
  heartbeatSeconds?: number;
  idleAfterSeconds?: number;
  disconnectAfterSeconds?: number;
}

export interface BridgeSettings {
  url: string;
  token: string;
  profile: string;
  pin: string;
}

export interface BridgeConnectResponse {
  ok?: boolean;
  connected?: boolean;
  profile?: string;
  pinRequired?: boolean;
  message?: string;
  session?: BridgeSessionState | null;
}

export interface BridgeStatusResponse {
  ok?: boolean;
  connected?: boolean;
  session?: BridgeSessionState | null;
}

export interface BridgeExecuteResponse {
  ok?: boolean;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  session?: BridgeSessionState | null;
}

const storageKey = (deviceId: string) => `tsb.bridge.${deviceId}`;

export function loadBridgeSettings(deviceId: string): BridgeSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(deviceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BridgeSettings>;
    if (typeof parsed.url !== "string" || !parsed.url.trim()) return null;
    return {
      url: parsed.url.trim(),
      token: typeof parsed.token === "string" ? parsed.token : "",
      profile: typeof parsed.profile === "string" ? parsed.profile : "",
      pin: typeof parsed.pin === "string" ? parsed.pin : "",
    };
  } catch {
    return null;
  }
}

export function saveBridgeSettings(deviceId: string, settings: BridgeSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(deviceId), JSON.stringify(settings));
}

export function clearBridgeSettings(deviceId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(deviceId));
}

export function normalizeGatewayUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new GatewayError(
      "invalid_url",
      "Enter the gateway URL, for example http://192.168.1.20:8765",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new GatewayError("invalid_url", "That gateway URL is not valid.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new GatewayError("invalid_url", "The gateway URL must start with http:// or https://");
  }
  return trimmed.replace(/\/+$/, "");
}

export function createBridgeClient(settings: BridgeSettings) {
  const base = normalizeGatewayUrl(settings.url);
  const token = settings.token.trim();
  const profile = settings.profile.trim();
  const pin = settings.pin.trim();

  return {
    status: () =>
      requestGateway<BridgeStatusResponse>(base, "/bridge/status", { method: "GET" }, token),
    connect: (overrideProfile?: string) => {
      const target = (overrideProfile ?? profile).trim();
      if (!target) {
        throw new GatewayError(
          "http",
          "Enter the phone-side SSH profile name (the one saved in the app).",
        );
      }
      return requestGateway<BridgeConnectResponse>(
        base,
        "/bridge/connect",
        {
          method: "POST",
          body: JSON.stringify({ profile: target, ...(pin ? { pin } : {}) }),
        },
        token,
      );
    },
    execute: (command: string) =>
      requestGateway<BridgeExecuteResponse>(
        base,
        "/bridge/execute",
        { method: "POST", body: JSON.stringify({ command }) },
        token,
      ),
    disconnect: () =>
      requestGateway<{ ok?: boolean; connected?: boolean }>(
        base,
        "/bridge/disconnect",
        { method: "POST" },
        token,
      ),
  };
}

export function describeBridgeError(error: unknown): string {
  if (error instanceof GatewayError) {
    if (error.kind === "unauthorized") return "Unauthorized — check the gateway bearer token.";
    if (error.kind === "forbidden") return error.message || "The gateway rejected that command.";
    if (error.kind === "invalid_url") return error.message;
    if (error.kind === "network") {
      return "Could not reach the phone gateway. Check the URL, that the phone is on the same network, and that it is not blocked as mixed content.";
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
