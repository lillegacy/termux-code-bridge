import { useCallback, useEffect, useRef, useState } from "react";
import type { FitAddon as XFitAddon } from "@xterm/addon-fit";
import type { Terminal as XTerm } from "@xterm/xterm";
import { Loader2, Play, Square } from "lucide-react";
import "@xterm/xterm/css/xterm.css";

import { Button } from "@/components/ui/button";
import {
  type BridgeSettings,
  bridgeWebSocketUrl,
  createBridgeClient,
  describeBridgeError,
} from "@/lib/bridge";

type Status = "idle" | "connecting" | "open" | "closed" | "error";

interface ControlMessage {
  type?: string;
  code?: number | null;
  message?: string;
}

const statusLabel: Record<Status, string> = {
  idle: "closed",
  connecting: "connecting…",
  open: "live",
  closed: "session ended",
  error: "failed",
};

export function BridgeTerminal({
  settings,
  connected,
}: {
  settings: BridgeSettings;
  connected: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<XFitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const tmuxRef = useRef(true);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [useTmux, setUseTmux] = useState(true);

  useEffect(() => {
    tmuxRef.current = useTmux;
  }, [useTmux]);

  const ensureTerminal = useCallback(async () => {
    if (termRef.current) return termRef.current;
    const [{ Terminal }, { FitAddon }] = await Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
    ]);
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      scrollback: 5000,
      theme: {
        background: "#0b0f14",
        foreground: "#e6edf3",
        cursor: "#38bdf8",
        selectionBackground: "#1f6feb66",
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    termRef.current = term;
    fitRef.current = fit;

    term.onData((data) => {
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "input", data }));
      }
    });
    term.onResize(({ cols, rows }) => {
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    });

    const host = containerRef.current;
    if (host) {
      term.open(host);
      try {
        fit.fit();
      } catch {
        // The element has no size yet; the ResizeObserver below fits it later.
      }
    }
    return term;
  }, []);

  const close = useCallback(() => {
    const socket = socketRef.current;
    socketRef.current = null;
    socket?.close();
    setStatus("closed");
  }, []);

  const open = useCallback(async () => {
    if (status === "connecting" || status === "open") return;
    setStatus("connecting");
    setMessage("");
    try {
      const term = await ensureTerminal();
      try {
        fitRef.current?.fit();
      } catch {
        // Ignore layout races; the size is sent again on every resize.
      }
      const ticket = await createBridgeClient(settings).terminalTicket();
      if (!ticket.ticket) {
        throw new Error("The gateway did not return a terminal ticket.");
      }
      const url = bridgeWebSocketUrl(settings, ticket.ticket, term.cols, term.rows);
      const socket = new WebSocket(url);
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;

      socket.onmessage = (event) => {
        if (socketRef.current !== socket) return;
        if (typeof event.data !== "string") {
          term.write(new Uint8Array(event.data as ArrayBuffer));
          return;
        }
        let control: ControlMessage;
        try {
          control = JSON.parse(event.data) as ControlMessage;
        } catch {
          return;
        }
        switch (control.type) {
          case "ready":
            term.reset();
            setStatus("open");
            if (tmuxRef.current) {
              socket.send(JSON.stringify({ type: "input", data: "tmux new -A -s web\r" }));
            }
            break;
          case "exit":
            setStatus("closed");
            setMessage(
              control.code === null || control.code === undefined
                ? "The remote shell exited."
                : `The remote shell exited with code ${control.code}.`,
            );
            break;
          case "error":
            setMessage(control.message ?? "The phone reported a terminal error.");
            break;
          default:
            break;
        }
      };

      socket.onerror = () => {
        if (socketRef.current !== socket) return;
        setStatus("error");
        setMessage("The WebSocket connection to the phone failed.");
      };

      socket.onclose = () => {
        if (socketRef.current !== socket) return;
        socketRef.current = null;
        setStatus((current) => (current === "error" ? current : "closed"));
      };

      socket.onopen = () => {
        if (socketRef.current !== socket) return;
        setStatus((current) => (current === "open" ? current : "connecting"));
      };
    } catch (error) {
      setStatus("error");
      setMessage(describeBridgeError(error));
    }
  }, [ensureTerminal, settings, status]);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    const observer = new ResizeObserver(() => {
      try {
        fitRef.current?.fit();
      } catch {
        // A hidden or zero-sized container is not fatal.
      }
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      socketRef.current?.close();
      socketRef.current = null;
      termRef.current?.dispose();
      termRef.current = null;
      fitRef.current = null;
    },
    [],
  );

  const live = status === "open" || status === "connecting";

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          web terminal
        </span>
        <span
          className={`font-mono text-xs ${status === "open" ? "text-primary" : "text-muted-foreground"}`}
        >
          {statusLabel[status]}
        </span>
        <label className="ml-auto flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={useTmux}
            onChange={(event) => setUseTmux(event.target.checked)}
          />
          tmux new -A -s web
        </label>
        {live ? (
          <Button size="sm" variant="outline" onClick={close}>
            {status === "connecting" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            Stop
          </Button>
        ) : (
          <Button size="sm" onClick={() => void open()} disabled={!connected}>
            <Play className="h-4 w-4" />
            Open terminal
          </Button>
        )}
      </div>
      <div
        ref={containerRef}
        className="mt-2 h-[420px] w-full overflow-hidden rounded-lg border border-border bg-[#0b0f14] p-2"
      />
      {!connected && (
        <p className="mt-2 text-xs text-muted-foreground">
          Connect the bridge first — the terminal runs inside the open SSH session.
        </p>
      )}
      {message && <p className="mt-2 text-xs text-destructive">{message}</p>}
      <p className="mt-2 text-xs text-muted-foreground">
        Full PTY over SSH. Keystrokes stream over a WebSocket; resizing the window updates the
        remote terminal size.
      </p>
    </div>
  );
}
