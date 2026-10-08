# Cognivyn Notify — Unified Notification Channel Connection System

Modular, SRP-compliant, production-ready multi-channel notification service.
SMS · Email · WhatsApp · Push · CLI · TypeScript · Bun · Turbo Repo

## Quick start

```bash
bun install
bun run build
bun test
bun run ./packages/cli/src/index.ts providers
bun run ./packages/cli/src/index.ts test sms --to +15551234567 --body "hello"
```

## Packages

- `@notify/types` — shared types
- `@notify/config` — configuration
- `@notify/auth` — ApiKey + ClientSecret, SecureStore
- `@notify/core` — NotificationService, Builder, Queue
- `@notify/channels` — sms (Twilio), email, whatsapp, push
- `@notify/cli` — `notify auth/test/config/providers`

## Docs

See `docs/` — getting started, architecture, auth, CLI, API, channel guides, troubleshooting.
Examples in `examples/basic.ts`.

## Success criteria (Epic #1)

- [x] All channels functional and tested (44 tests)
- [x] CLI fully operational
- [x] Comprehensive documentation
- [x] Zero over-engineering, minimal deps, Bun 1.4.2 + Turbo
