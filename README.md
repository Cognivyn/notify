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

- `@cognivyn/types` — shared types
- `@cognivyn/config` — configuration (`@cognivyn/config`, `@cognivyn/config/manager`)
- `@cognivyn/auth` — ApiKey + ClientSecret, SecureStore (`@cognivyn/auth`, `@cognivyn/auth/providers`, `@cognivyn/auth/store`)
- `@cognivyn/core` — NotificationService, Builder, Queue (`@cognivyn/core`, `@cognivyn/core/service`, `@cognivyn/core/builder`, `@cognivyn/core/queue`)
- `@cognivyn/channels` — tree-shakable subpaths for channels:
  - `@cognivyn/channels/sms` (Twilio, MSG91 Flow API v5 + Route SMS)
  - `@cognivyn/channels/email` (Resend, AWS SESv2 SigV4)
  - `@cognivyn/channels/whatsapp` (Meta WhatsApp Cloud API v21.0+, Twilio WhatsApp)
  - `@cognivyn/channels/push` (FCM HTTP v1, FCM Legacy, Apple APNs)
- `@cognivyn/cli` — `notify auth/test/config/providers`

## Tree-Shaking & Subpath Imports

All packages declare `sideEffects: false` and explicit `exports` maps. Consumers can import individual features without dragging in unused channels or dependencies:

```ts
import { SmsChannel, Msg91SmsProvider } from "@cognivyn/channels/sms";
import { WhatsAppChannel, WhatsAppCloudApiProvider } from "@cognivyn/channels/whatsapp";
import { PushChannel, FcmV1PushProvider } from "@cognivyn/channels/push";
import { EmailChannel, ResendEmailProvider } from "@cognivyn/channels/email";
import { NotificationService } from "@cognivyn/core/service";
```

See [docs/tree-shaking.md](docs/tree-shaking.md) for full details.

## Docs

See `docs/` — getting started, architecture, auth, CLI, API, channel guides, tree-shaking, troubleshooting.
Examples in `examples/basic.ts`.

## Standards & Invariants

- [x] All channels functional and tested (105+ tests)
- [x] Modern APIs supported: Meta WhatsApp Cloud API v21.0, Google FCM HTTP v1, AWS SESv2, Resend, Twilio, MSG91 Flow API
- [x] CLI fully operational with multi-channel testing and auth config
- [x] Comprehensive documentation and AI Agent ready (`AGENTS.md`, `CLAUDE.md`)
- [x] Zero unnecessary third-party dependencies, minimal deps, Bun 1.4+ & Turbo

## Trademark Notice

Cognivyn is not affiliated with, endorsed by, or sponsored by Twilio, Meta, Google, Amazon, Resend, or MSG91. All provider trademarks belong to their respective owners. This library implements their public APIs independently.

## License

[MIT](LICENSE) — © 2026 Cognivyn
