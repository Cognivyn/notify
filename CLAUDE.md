# CLAUDE.md — Operating Guidelines for Claude & AI Agents

Commands and conventions for development in `@cognivyn/notify`.

## Quick Commands (Always Use Bun)

```bash
bun install             # Install dependencies
bun run build           # Turbo build all packages (tsc -p tsconfig.json)
bun test                # Run all unit and integration tests
bun run type-check      # Type check across all workspaces (tsc --noEmit)
bun run lint            # ESLint check
bun run format:check    # Check Prettier formatting
bun run format          # Fix Prettier formatting
```

Run CLI locally:

```bash
bun run ./packages/cli/dist/index.js providers
bun run ./packages/cli/dist/index.js test sms --to +15551234567 --body "hello"
```

## Architecture & Code Conventions

- **Runtime**: Bun `>=1.4.2`. Never use `npm`, `npx`, `yarn`, or `pnpm`.
- **Zero Heavy SDKs**: Implement APIs using native `fetch` and `node:crypto`. Do not add bloated vendor SDK packages (`@aws-sdk/*`, `firebase-admin`, `twilio`).
- **Injectable `fetchFn`**: All provider classes accept `fetchFn?: typeof fetch` in constructor options to allow 100% offline, deterministic tests.
- **Tree-Shaking**: All packages specify `sideEffects: false` and explicit `exports` maps.
- **Security & Validation**:
  - Phone numbers: strict E.164 (`^\+[1-9]\d{7,14}$`).
  - Emails: RFC 5322 validation, subject CRLF injection prevention (`\r`, `\n`), max 998 chars.
  - Deep links: Block `javascript:`, `data:`, `file:`, `vbscript:`, and `//`.
  - Device tokens: Sanitize path traversal (`..`, `/`, `\`) and control characters.
- **Supported Providers**:
  - SMS: Twilio, MSG91 (Flow API v5 + route SMS)
  - Email: Resend, AWS SESv2 (SigV4 stdlib crypto)
  - WhatsApp: Meta WhatsApp Cloud API v21.0+, Twilio WhatsApp
  - Push: Google FCM HTTP v1 (`FcmV1PushProvider`), FCM Legacy, Apple APNs (ES256)

## Filesystem Rules

- Never use `ls` or search inside `node_modules`.
- Always verify changes with `bun test` and `bun run type-check` before completing tasks.
