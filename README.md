# Cognivyn Notify — Unified Notification Channel Connection System

Modular, SRP-compliant, production-ready multi-channel notification service.
SMS · Email · WhatsApp · Push · CLI · TypeScript · Bun · Turbo Repo · Tree-shakable

## Quick start

```bash
bun install
bun run build
bun test
bun run ./packages/cli/dist/index.js providers
bun run ./packages/cli/dist/index.js test sms --to +15551234567 --body "hello"
```

## Packages

- `@notify/types` — shared types
- `@notify/config` — configuration (`@notify/config`, `@notify/config/manager`)
- `@notify/auth` — ApiKey + ClientSecret, SecureStore (`@notify/auth`, `@notify/auth/providers`, `@notify/auth/store`)
- `@notify/core` — NotificationService, Builder, Queue (`@notify/core`, `@notify/core/service`, `@notify/core/builder`, `@notify/core/queue`)
- `@notify/channels` — tree-shakable subpaths for channels:
  - `@notify/channels/sms` (Twilio, MSG91)
  - `@notify/channels/email` (Resend, SES)
  - `@notify/channels/whatsapp`
  - `@notify/channels/push` (FCM, APNs)
- `@notify/cli` — `notify auth/test/config/providers`

## Tree-Shaking & Subpath Imports

All packages declare `sideEffects: false` and explicit `exports` maps. Consumers can import individual features without dragging in unused channels or dependencies:

```ts
import { SmsChannel, Msg91SmsProvider } from "@notify/channels/sms";
import { NotificationService } from "@notify/core/service";
```

See [docs/tree-shaking.md](docs/tree-shaking.md) for full details.

## Docs

See `docs/` — getting started, architecture, auth, CLI, API, channel guides, tree-shaking, troubleshooting.
Examples in `examples/basic.ts`.

## Success criteria (Epic #1)

- [x] All channels functional and tested (44 tests)
- [x] CLI fully operational
- [x] Comprehensive documentation
- [x] Zero over-engineering, minimal deps, Bun 1.4.2 + Turbo
