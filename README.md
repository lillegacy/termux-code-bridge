# Termux Code Bridge

ok so i made an app with vscode github that connects to termux

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d577447f-b32e-4963-8358-463aabb119c5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Gateway bridge contract

This web app is designed to talk to the Android Termux SSH Bridge app as a remote execution gateway.
The bridge exposes a small HTTP JSON API that is already modeled by the phone app: health checks, profile-based connect, command execution, and disconnects.

### Phone-compatible contract

```ts
// Example gateway client usage against the phone app
import { createGatewayClient } from "@/lib/gateway-client";

// Get the token from the phone app; avoid hard-coding it or exposing it in a build-time env var.
const gateway = createGatewayClient("http://127.0.0.1:8765", tokenEnteredByUser);

const health = await gateway.health();
await gateway.connect({ profile: "Default Tailscale Termux" });
const exec = await gateway.execute({ command: "uname -a" });
```

The gateway app expects these endpoints and payloads:

- `GET /health` -> returns connection state
- `POST /connect` -> body is `{ "profile": "Default Tailscale Termux" }`
- `POST /execute` -> body is `{ "command": "uname -a" }`
- `POST /disconnect` -> closes the active SSH connection

Example response from the phone gateway:

```json
{
  "ok": true,
  "status": "ok",
  "sshConnected": true,
  "sshConnecting": false,
  "activeProfile": "default"
}
```

```json
{
  "ok": true,
  "stdout": "Linux termux 6.1.0-aarch64\n",
  "stderr": "",
  "exitCode": 0
}
```

Open the **Gateway** console in the web app, enter the URL and bearer token
shown in the phone app's API tab, then enter a stored profile name to connect.
The token remains in browser memory unless you explicitly opt in to remembering
it. A hosted HTTPS page cannot call a remote plain-HTTP gateway; use an HTTPS
tunnel/reverse proxy or a local SSH tunnel. The phone gateway enforces its own
command allowlist.

The **Devices** dashboard is a separate cloud command-queue feature and does
not connect to the phone app's gateway API.
