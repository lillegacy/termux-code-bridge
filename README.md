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

This web app is designed to orchestrate a separate Android or CLI gateway that owns the SSH session.
The gateway is expected to expose a small JSON API for pairing, status, execution, and result reporting.

### Core contract

```ts
// Example gateway client usage
import { createGatewayClient } from "@/lib/gateway-client";

const gateway = createGatewayClient("https://gateway.local", process.env.GATEWAY_API_TOKEN);

const health = await gateway.health();
const exec = await gateway.execute({ command: "uname -a", timeoutMs: 15000 });
```

Endpoints the gateway should support:

- `GET /health`
- `POST /connect`
- `POST /execute`
- `POST /disconnect`
- `POST /result`

Example payloads:

```json
{ "host": "100.x.x.x", "port": 8022, "username": "u0_a123", "password": "secret" }
```

```json
{ "command": "pwd && whoami", "timeoutMs": 20000, "cwd": "/data/data/com.termux/files/home" }
```

```json
{ "ok": true, "exitCode": 0, "stdout": "...", "stderr": "", "timestamp": "2026-11-08T11:00:00Z" }
```

The web app should treat the gateway as a remote execution service instead of directly handling SSH or Termux details.
