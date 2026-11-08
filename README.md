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

const gateway = createGatewayClient("http://127.0.0.1:8765", process.env.GATEWAY_API_TOKEN);

const health = await gateway.health();
await gateway.connect({ profile: "Default Tailscale Termux" });
const exec = await gateway.execute({ command: "uname -a" });
```

The gateway app expects these endpoints and payloads:

- `GET /health` -> returns connection state
- `POST /connect` -> body is `{ "profile": "Default Tailscale Termux" }`
- `POST /execute` -> body is `{ "command": "uname -a" }`
- `POST /disconnect` -> closes the active SSH connection

The client stays compatible with the older host/port shape as a fallback, but it now normalizes requests to the phone app's `profile`-based contract so the browser app can talk to the bridge correctly.

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
  "stdout": "Linux termux 6.1.0-aarch64
",
  "stderr": "",
  "exitCode": 0
}
```
