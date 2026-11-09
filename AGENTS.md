# AGENTS.md — AI Agent Guidance & Repository Blueprint

This document is the authoritative specification and operating guide for AI agents (including Vani, Antigravity, Claude, OpenCode, Kilo, and Cursor) working within the `@cognivyn/notify` codebase.

---

## 1. Project Mission & Architecture

`@cognivyn/notify` is a high-performance, modular, SRP-compliant, production-grade notification dispatch system written in TypeScript for the **Bun** runtime. It orchestrates notification delivery across multiple messaging channels: **SMS**, **Email**, **WhatsApp**, and **Push**.

### Core Architecture Invariants

1. **Bun Runtime Exclusively**: Always use `bun` for package management, running tests, scripts, and building. Never run `npm`, `npx`, `yarn`, or `pnpm`.
2. **Zero Bloated SDK Dependencies**: Implement provider APIs using native `fetch` and standard library Node.js crypto (`node:crypto`). Avoid pulling in heavy vendor SDKs (e.g. avoid `@aws-sdk/client-sesv2`, `twilio`, `@google-cloud/firestore`, `firebase-admin`). This guarantees instant cold starts, minimal disk footprint, and clean runtime behavior.
3. **Single Responsibility Principle (SRP)**:
   - **Channels** (`SmsChannel`, `EmailChannel`, `WhatsAppChannel`, `PushChannel`) handle validation, retry policy, and payload normalization.
   - **Providers** (`TwilioSmsProvider`, `WhatsAppCloudApiProvider`, `FcmV1PushProvider`, `ResendEmailProvider`, etc.) handle raw HTTP wire transmission, signing, and vendor error parsing.
   - **Core** (`NotificationService`, `NotificationBuilder`, `NotificationQueue`) coordinates channels, fallback strategies, batching, and throttling.
4. **Tree-Shakable Subpath Exports**: Every package specifies `sideEffects: false` and exports explicit granular subpaths (e.g., `@cognivyn/channels/sms`, `@cognivyn/channels/whatsapp`, `@cognivyn/core/service`).
5. **Injectable `fetchFn`**: All provider classes MUST accept an optional `fetchFn: typeof fetch` in constructor options to allow 100% offline, deterministic unit testing without mocking global network interfaces.

---

## 2. Monorepo Structure & Package Map

```text
packages/
├── types/         # @cognivyn/types: ChannelType, NotificationPayload, DeliveryResult, ChannelAdapter
├── config/        # @cognivyn/config: ConfigManager key/value runtime storage
├── auth/          # @cognivyn/auth: ApiKeyAuth, ClientSecretAuth, SecureStore
├── core/          # @cognivyn/core: NotificationService, NotificationBuilder, NotificationQueue
├── channels/      # @cognivyn/channels: Multi-provider channel adapters
│   ├── sms.ts       -> Twilio, MSG91 (Flow API v5 + route SMS)
│   ├── email.ts     -> Resend, AWS SESv2 (SigV4 stdlib crypto)
│   ├── whatsapp.ts  -> Meta WhatsApp Cloud API v21.0+, Twilio WhatsApp
│   └── push.ts      -> FCM HTTP v1 (OAuth2 Bearer), FCM Legacy, Apple APNs (ES256)
└── cli/           # @cognivyn/cli: `notify` terminal tool (auth, test, config, providers)
```

---

## 3. Standard Commands & Verification

Run all commands using `bun`:

| Task             | Command                                          | Notes                                            |
| :--------------- | :----------------------------------------------- | :----------------------------------------------- |
| **Install**      | `bun install`                                    | Resolves workspace dependencies                  |
| **Build**        | `bun run build`                                  | Runs Turbo build (`tsc -p tsconfig.json`)        |
| **Test**         | `bun test`                                       | Runs all unit and integration tests (100+ tests) |
| **Type-Check**   | `bun run type-check`                             | Runs Turbo `tsc --noEmit` across all workspaces  |
| **Format Check** | `bun run format:check`                           | Verifies Prettier compliance                     |
| **Format Fix**   | `bun run format`                                 | Applies Prettier formatting                      |
| **CLI Run**      | `bun run ./packages/cli/dist/index.js <command>` | Test CLI commands                                |

---

## 4. Supported Channels & Provider APIs

### A. SMS Channel (`@cognivyn/channels/sms`)

- **Twilio** (`TwilioSmsProvider`):
  - Endpoint: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  - Authentication: HTTP Basic (`${accountSid}:${authToken}`)
  - Validation: AccountSid alphanumeric sanitization.
- **MSG91** (`Msg91SmsProvider`):
  - **Flow API v5** (Recommended): `https://control.msg91.com/api/v5/flow` for template ID, dynamic variables, and `short_url`.
  - **Route Fallback**: `https://api.msg91.com/api/v5/sms` for direct route-based SMS.
  - Authentication: `authkey` header.
  - Parameter pollution protection on mobile numbers.

### B. Email Channel (`@cognivyn/channels/email`)

- **Resend** (`ResendEmailProvider`):
  - Endpoint: `https://api.resend.com/emails`
  - Authentication: `Bearer ${apiKey}`
  - Features: HTML, text, `cc`, `bcc`, `replyTo`, `headers`, `tags`, and base64 `attachments`.
- **AWS SESv2** (`SesEmailProvider`):
  - Endpoint: `https://email.${region}.amazonaws.com/v2/email/outbound-emails`
  - Authentication: AWS Signature Version 4 (`signSesV4`) using native `node:crypto`. Zero AWS SDK dependencies.
  - Features: `ToAddresses`, `CcAddresses`, `BccAddresses`, `ReplyToAddresses`, `EmailTags`.

### C. WhatsApp Channel (`@cognivyn/channels/whatsapp`)

- **Meta WhatsApp Cloud API** (`WhatsAppCloudApiProvider`):
  - Endpoint: `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages` (default `v21.0`)
  - Authentication: `Bearer ${accessToken}`
  - Features: Text with `preview_url`, template messages with dynamic parameter components, and media (image, document, audio, video).
- **Twilio WhatsApp** (`TwilioWhatsAppProvider`):
  - Endpoint: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  - Authentication: HTTP Basic auth.
  - Features: Auto-prefixing `whatsapp:` to destination and sender, media via `MediaUrl`.

### D. Push Channel (`@cognivyn/channels/push`)

- **FCM HTTP v1** (`FcmV1PushProvider`):
  - Endpoint: `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`
  - Authentication: `Bearer ${accessToken}` (static string or async token generator function).
  - Modern payload: RFC-compliant `{ message: { token, notification: { title, body, image }, data } }`.
- **Apple APNs** (`ApnsPushProvider`):
  - Endpoint: `api.push.apple.com/3/device/${token}` (production) or `api.development.push.apple.com/3/device/${token}`
  - Authentication: `bearer ${providerToken}` (ES256 Apple Developer JWT), `apns-topic` header.
- **FCM Legacy** (`FcmPushProvider`):
  - Endpoint: `https://fcm.googleapis.com/fcm/send` (legacy server key, kept for backwards compatibility).

---

## 5. Security & Validation Invariants

AI agents modifying or adding features MUST adhere to the following security validations:

1. **Phone Numbers**: Must pass E.164 regex `^\+[1-9]\d{7,14}$`.
2. **Email Addresses**: Must match standard RFC 5322 regex.
3. **CRLF Header Injection Prevention**: Email subjects MUST NOT contain `\r` or `\n`. Maximum subject length is 998 characters.
4. **Deep Link Sanitation**: Deep links are validated with `validateDeepLink()`. Schemes `javascript:`, `data:`, `file:`, `vbscript:`, and protocol-relative `//` URLs are strictly rejected.
5. **Device Token Validation**: Must reject path traversal sequences (`..`, `/`, `\`) and ASCII control characters.
6. **Template Parameter Injection**: Dynamic token interpolation (`renderTemplate` and WhatsApp `template`) must escape HTML when configured and avoid regex `$1`, `$&` injection bugs.

---

## 6. How to Add a New Provider

When adding a provider (e.g. SendGrid for email, or Telegram for chat):

1. **Create/Update Provider Class** in `packages/channels/src/<channel>.ts`:
   - Implement the channel's Provider interface.
   - Inject `fetchFn: typeof fetch = fetch` in the constructor.
   - Use strict option validation.
2. **Update Subpath Exports**:
   - Ensure the new provider is exported from the channel's module (`packages/channels/src/<channel>.ts` and `packages/channels/src/index.ts`).
3. **Update CLI**:
   - Register provider name in `packages/cli/src/index.ts` under the `providers` command.
4. **Write Tests**:
   - Add unit test suite in `packages/channels/test/<channel>.test.ts` with 100% mocked `fetchFn`.
   - Test successful transmission, payload shaping, headers, error responses, and option validation.
5. **Verify**:
   - Run `bun test`, `bun run type-check`, and `bun run build`.

---

## 7. Operating Rules for AI Agents

- **Never use `ls`** or inspect `node_modules`. Use PowerShell `dir` / `Get-ChildItem` excluding `node_modules` and `.next`.
- **Never delete or overwrite comments** or docstrings unrelated to your changes.
- **Always preserve backward compatibility** with existing exports and interfaces.
- **Keep responses concise** and use `file://` markdown links for paths.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
