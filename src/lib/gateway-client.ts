export type GatewayCommandStatus = "done" | "failed" | "rejected";

export interface GatewayHealthResponse {
  ok: boolean;
  connected?: boolean;
  host?: string;
  port?: number;
  username?: string;
  error?: string;
  message?: string;
}

export interface GatewayConnectRequest {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface GatewayExecuteRequest {
  command: string;
  timeoutMs?: number;
  cwd?: string;
}

export interface GatewayExecuteResponse {
  ok: boolean;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
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

export function buildGatewayHeaders(token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

export async function requestGateway<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const target = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
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
    throw new Error(payload?.error ?? payload?.message ?? `Gateway request failed (${response.status})`);
  }

  return (data ?? ({} as T)) as T;
}

export function createGatewayClient(baseUrl: string, token?: string) {
  return {
    health: () => requestGateway<GatewayHealthResponse>(baseUrl, "/health", { method: "GET" }, token),
    connect: (payload: GatewayConnectRequest) =>
      requestGateway<GatewayHealthResponse>(baseUrl, "/connect", { method: "POST", body: JSON.stringify(payload) }, token),
    execute: (payload: GatewayExecuteRequest) =>
      requestGateway<GatewayExecuteResponse>(baseUrl, "/execute", { method: "POST", body: JSON.stringify(payload) }, token),
    disconnect: () => requestGateway<{ ok: boolean }>(baseUrl, "/disconnect", { method: "POST" }, token),
    submitResult: (payload: GatewayResultRequest) =>
      requestGateway<{ ok: boolean }>(baseUrl, "/result", { method: "POST", body: JSON.stringify(payload) }, token),
  };
}
