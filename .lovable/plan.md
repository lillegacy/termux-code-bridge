# Termux Companion Dashboard

A web dashboard where you sign in, link your devices/apps to your account, and send commands to them — with room to add an AI agent later.

## How linking works

```text
[Dashboard (web)]  <-- sign in -->  You
       |  1. "Add device" shows a one-time pairing code
       v
[Your app on Termux] enters code --> gets its own device key
       |  2. App checks in every few seconds: "any commands for me?"
       |  3. Runs them over its existing SSH/Termux link, sends output back
       v
[Dashboard] shows live status + command output
```

**Your app is always in charge.** The dashboard is only a command hub: it can suggest commands, but the app decides whether to run them, and the app can unlink itself at any time (which instantly revokes its key). The pairing step on your app's side can be added later — the dashboard will be ready and waiting.

The web dashboard can't open SSH to your phone directly (phones sit behind home/mobile networks), so your app "calls home" instead. This works anywhere with internet, no port forwarding.

## What you'll get

1. **Accounts** — sign up / sign in (email + Google).
2. **Devices page** — list of linked apps with online/offline status, last seen, rename, unlink.
3. **Pair a device** — generate a short code (expires in 10 min); your app trades it for a permanent device key.
4. **Device console** — type a command, see it queued, running, and the output when done; history of past commands.
5. **Docs page** — copy-paste snippet showing exactly what your app needs to call (pair, check in, report result).
6. **Later (not in this step)** — an "Agent" tab where an AI plans and runs commands step by step, with your approval.

## Design

Dark terminal-inspired look: near-black background, phosphor-green accent, monospace for output, clean sans for UI.

## Technical details

- Enable Lovable Cloud for auth + database.
- Tables: `devices` (owner, name, hashed device key, last_seen), `pairing_codes` (owner, code, expires_at, used), `commands` (device, owner, command text, status queued/running/done/failed, output, exit code, timestamps). RLS: owners see only their own rows.
- Device API as public server routes, authenticated by device key (hashed, compared server-side):
  - `POST /api/public/device/pair` — code -> device key (shown once)
  - `GET /api/public/device/poll` — returns next queued commands, updates last_seen
  - `POST /api/public/device/result` — posts output/exit code (or "rejected" if the app declines)
  - `POST /api/public/device/unlink` — app removes itself; key revoked, pending commands cancelled
- Dashboard uses protected server functions; command list refreshes automatically.
- Your existing app needs a small addition: store the device key and run a poll loop.
