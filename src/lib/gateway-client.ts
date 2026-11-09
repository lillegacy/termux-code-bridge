// Client for the Termux SSH Bridge Gateway. Talks ONLY to the configured gateway URL.
// Uses exactly four documented endpoints: /health, /connect, /execute, /disconnect.

export interface GatewayHealthResponse {
  ok?: boolean;
  connected?: boolean;
  profile?: string;
  [key: string]: unknown;
}

export interface GatewayConnectRequest {
  profile: string;
}

export interface GatewayExecuteRequest {
  command: string;
}

export interface GatewayExecuteResponse {
  ok?: boolean;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  [key: string]: unknown;
}

export type GatewayErrorKind = "unauthorized" | "forbidden" | "network" | "http" | "invalid_url";

export class GatewayError extends Error {
  kind: GatewayErrorKind;
  status?: number | undefined;
  code?: string | undefined;
  constructor(kind: GatewayErrorKind, message: string, status?: number, code?: string) {
    super(message);
    this.name = "GatewayError";
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

export function buildGatewayHeaders(token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

/** Extracts a message from the gateway JSON error envelope (flat or nested `error` object). */
export function parseErrorEnvelope(data: unknown): { message?: string | undefined; code?: string | undefined } {
  if (!data || typeof data !== "object") return typeof data === "string" && data ? { message: data } : {};
  const d = data as Record<string, unknown>;
  const err = d["error"];
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    return {
      message: typeof e["message"] === "string" ? e["message"] : undefined,
      code: typeof e["code"] === "string" ? e["code"] : undefined,
    };
  }
  return {
    message: typeof err === "string" ? err : typeof d["message"] === "string" ? (d["message"] as string) : undefined,
    code: typeof d["code"] === "string" ? (d["code"] as string) : undefined,
  };
}

/** True when an https page tries to call a plain-http, non-localhost gateway (browser will block it). */
export function isMixedContent(pageProtocol: string, baseUrl: string) {
  try {
    const u = new URL(baseUrl);
    if (pageProtocol !== "https:" || u.protocol !== "http:") return false;
    return !["127.0.0.1", "localhost", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
}

export async function requestGateway<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  let target: string;
  try {
    target = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
  } catch {
    throw new GatewayError("invalid_url", "Gateway URL is not valid.");
  }

  let response: Response;
  try {
    response = await fetch(target, { ...init, headers: { ...buildGatewayHeaders(token), ...init.headers } });
  } catch {
    throw new GatewayError(
      "network",
      "Could not reach the gateway. Check the URL, that the gateway is running, and browser mixed-content/CORS rules.",
    );
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const { message, code } = parseErrorEnvelope(data);
    const kind: GatewayErrorKind =
      response.status === 401 ? "unauthorized" : response.status === 403 ? "forbidden" : "http";
    const fallback =
      kind === "unauthorized" ? "Unauthorized — check your bearer token." :
      kind === "forbidden" ? "Forbidden by the gateway." : `Gateway request failed (${response.status}).`;
    throw new GatewayError(kind, message ?? fallback, response.status, code);
  }

  return (data ?? {}) as T;
}

export function createGatewayClient(baseUrl: string, token?: string) {
  return {
    health: () => requestGateway<GatewayHealthResponse>(baseUrl, "/health", { method: "GET" }, token),
    connect: (payload: GatewayConnectRequest) =>
      requestGateway<GatewayHealthResponse>(baseUrl, "/connect", { method: "POST", body: JSON.stringify(payload) }, token),
    execute: (payload: GatewayExecuteRequest) =>
      requestGateway<GatewayExecuteResponse>(baseUrl, "/execute", { method: "POST", body: JSON.stringify(payload) }, token),
    disconnect: () => requestGateway<{ ok?: boolean }>(baseUrl, "/disconnect", { method: "POST" }, token),
  };
}
