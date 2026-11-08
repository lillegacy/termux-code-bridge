export type GatewayCommandStatus = "done" | "failed" | "rejected";

export interface GatewayHealthResponse {
  ok: boolean;
  status?: string;
  sshConnected?: boolean;
  sshConnecting?: boolean;
  activeProfile?: string;
  connected?: boolean;
  host?: string;
  port?: number;
  username?: string;
  error?: string;
  message?: string;
}

export interface GatewayConnectRequest {
  profile?: string;
  name?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
}

export interface GatewayExecuteRequest {
  command: string;
  timeoutMs?: number;
  cwd?: string;
}

export interface GatewayExecuteResponse {
  ok: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  status?: string;
  timestamp?: string;
  error?: string;
  message?: string;
}

export interface GatewayResultRequest {
  commandId: string;
  status: GatewayCommandStatus;
  output?: string;
  exitCode?: number;
}

export function normalizeGatewayConnectRequest(
  payload: GatewayConnectRequest,
): Record<string, string | number> {
  const profile = payload.profile?.trim() || payload.name?.trim();
  const normalized: Record<string, string | number> = {};

  if (profile) {
    normalized.profile = profile;
  }

  if (payload.host) {
    normalized.host = payload.host;
  }

  if (payload.port !== undefined) {
    normalized.port = payload.port;
  }

  if (payload.username) {
    normalized.username = payload.username;
  }

  if (payload.password) {
    normalized.password = payload.password;
  }

  if (!normalized.profile && payload.host) {
    normalized.profile = payload.host + ":" + (payload.port ?? 8022);
  }

  return normalized;
}

export function buildGatewayHeaders(token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = "Bearer " + token;
  }

  return headers;
}

export async function requestGateway<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const target = new URL(
    path,
    baseUrl.endsWith("/") ? baseUrl : baseUrl + "/",
  ).toString();

  const response = await fetch(target, {
    ...init,
    headers: {
      ...buildGatewayHeaders(token),
      ...init.headers,
    },
  });

  const text = await response.text();
  let data: T | null = null;

  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = text as unknown as T;
    }
  }

  if (!response.ok) {
    const payload = data as { error?: string; message?: string } | null;
    throw new Error(
      payload?.error ??
        payload?.message ??
        ("Gateway request failed (" + response.status + ")"),
    );
  }

  return (data ?? ({} as T)) as T;
}

export function createGatewayClient(baseUrl: string, token?: string) {
  return {
    health: () =>
      requestGateway<GatewayHealthResponse>(
        baseUrl,
        "/health",
        { method: "GET" },
        token,
      ),
    connect: (payload: GatewayConnectRequest) =>
      requestGateway<GatewayHealthResponse>(
        baseUrl,
        "/connect",
        {
          method: "POST",
          body: JSON.stringify(normalizeGatewayConnectRequest(payload)),
        },
        token,
      ),
    execute: (payload: GatewayExecuteRequest) => {
      const body: Record<string, string | number> = { command: payload.command };

      if (payload.timeoutMs !== undefined) {
        body.timeoutMs = payload.timeoutMs;
      }

      if (payload.cwd) {
        body.cwd = payload.cwd;
      }

      return requestGateway<GatewayExecuteResponse>(
        baseUrl,
        "/execute",
        { method: "POST", body: JSON.stringify(body) },
        token,
      );
    },
    disconnect: () =>
      requestGateway<{ ok: boolean }>(
        baseUrl,
        "/disconnect",
        { method: "POST" },
        token,
      ),
    submitResult: (payload: GatewayResultRequest) =>
      requestGateway<{ ok: boolean }>(
        baseUrl,
        "/result",
        { method: "POST", body: JSON.stringify(payload) },
        token,
      ),
  };
}
