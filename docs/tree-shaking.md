# Tree-Shaking & Package Entrypoints

Cognivyn Notify is built as a fully tree-shakable, modular library designed for modern npm consumers and bundlers (Vite, Webpack, Rollup, esbuild, Turbopack, Bun, and Node.js).

## Key Architecture Features

1. **`sideEffects: false`**: Declared across all package manifests to allow bundlers to prune unused code safely.
2. **Explicit `exports` Maps**: Full subpath exports map for modern ESM runtimes and module resolution.
3. **Dedicated Subpath Entrypoints**: Consumers can import individual channels or core modules directly, paying only for the dependencies they use.
4. **Compiled Artifacts (`dist/`)**: Each package emits compiled ESM (`.js`), type declarations (`.d.ts`), and source maps (`.map`).
5. **No Direct Source Imports**: Manifests point to `dist/`, keeping production bundles lean and npm-ready.

---

## Recommended Import Patterns

### 1. Channel Subpaths (`@cognivyn/channels`)

Instead of importing from the barrel export `@cognivyn/channels` (which references all channel implementations), import only the channel you need:

```ts
// ✅ Optimal: Bundler imports ONLY SMS providers (Twilio, MSG91, Mock)
import { SmsChannel, Msg91SmsProvider, TwilioSmsProvider } from "@cognivyn/channels/sms";

// ✅ Optimal: Bundler imports ONLY Email providers (Resend, SES, Mock)
import { EmailChannel, ResendEmailProvider, SesEmailProvider } from "@cognivyn/channels/email";

// ✅ Optimal: Bundler imports ONLY WhatsApp adapter
import { WhatsAppChannel } from "@cognivyn/channels/whatsapp";

// ✅ Optimal: Bundler imports ONLY Push notification providers (FCM, APNs, Mock)
import { PushChannel, FcmPushProvider, ApnsPushProvider } from "@cognivyn/channels/push";
```

You can still use the root package export if you utilize all channels:

```ts
// Full suite
import { SmsChannel, EmailChannel, WhatsAppChannel, PushChannel } from "@cognivyn/channels";
```

### 2. Core Subpaths (`@cognivyn/core`)

```ts
// Only NotificationService
import { NotificationService } from "@cognivyn/core/service";

// Only type-safe NotificationBuilder
import { NotificationBuilder } from "@cognivyn/core/builder";

// Only NotificationQueue
import { NotificationQueue } from "@cognivyn/core/queue";
```

### 3. Auth & Config Subpaths

```ts
// Only Auth providers (ApiKeyAuth, ClientSecretAuth, etc.)
import { ApiKeyAuth, ClientSecretAuth, createAuthProvider } from "@cognivyn/auth/providers";

// Only SecureStore (credential storage)
import { SecureStore } from "@cognivyn/auth/store";

// Only ConfigManager
import { ConfigManager } from "@cognivyn/config/manager";
```

---

## Package Manifest Structure

Each package follows this modern npm exports standard:

```json
{
  "name": "@cognivyn/channels",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "sideEffects": false,
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./sms": {
      "types": "./dist/sms.d.ts",
      "import": "./dist/sms.js",
      "default": "./dist/sms.js"
    },
    "./email": {
      "types": "./dist/email.d.ts",
      "import": "./dist/email.js",
      "default": "./dist/email.js"
    },
    "./whatsapp": {
      "types": "./dist/whatsapp.d.ts",
      "import": "./dist/whatsapp.js",
      "default": "./dist/whatsapp.js"
    },
    "./push": {
      "types": "./dist/push.d.ts",
      "import": "./dist/push.js",
      "default": "./dist/push.js"
    },
    "./package.json": "./package.json"
  }
}
```

---

## Build Pipeline

Compile all packages using Turborepo and TypeScript:

```bash
# Build all packages to dist/
bun run build

# Clean compiled dist/ artifacts
bun run clean

# Run full workspace typecheck
bun run type-check
```
