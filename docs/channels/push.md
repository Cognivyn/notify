# Push — FCM v1 / APNs / Mock

The Push channel delivers mobile and web push notifications through the `PushProvider` adapter interface. Built-in providers include `FcmV1PushProvider` (Modern Firebase Cloud Messaging HTTP v1 API), `ApnsPushProvider` (Apple Push Notification service via ES256 JWT), and `MockPushProvider`.

## Quick start

### 1. FCM HTTP v1 API (Recommended)

Google's modern FCM HTTP v1 protocol (`https://fcm.googleapis.com/v1/projects/{projectId}/messages:send`). Uses OAuth 2.0 Bearer tokens (static token or async token provider function).

```ts
import { PushChannel, FcmV1PushProvider } from "@cognivyn/channels/push";

const channel = new PushChannel({
  provider: new FcmV1PushProvider({
    projectId: process.env.FIREBASE_PROJECT_ID!,
    accessToken: process.env.GOOGLE_OAUTH_ACCESS_TOKEN!,
    // Or async token provider:
    // accessToken: async () => await getGoogleAccessToken(),
  }),
  retries: 2,
});

await channel.send({
  channel: "push",
  to: "fcm-device-registration-token",
  title: "Order Shipped",
  body: "Your package is on its way!",
  imageUrl: "https://example.com/item.png",
  data: {
    orderId: "12345",
    deepLink: "myapp://orders/12345",
  },
});
```

### 2. Apple Push Notification service (APNs)

Direct HTTP/2 push notification delivery to iOS and macOS devices using an Apple Developer ES256 provider JWT token.

```ts
import { PushChannel, ApnsPushProvider } from "@cognivyn/channels/push";

const channel = new PushChannel({
  provider: new ApnsPushProvider({
    providerToken: process.env.APNS_PROVIDER_TOKEN!, // Pre-signed ES256 JWT
    bundleId: "com.acme.app",
    production: process.env.NODE_ENV === "production", // Selects production or sandbox gateway
  }),
  retries: 2,
});

await channel.send({
  channel: "push",
  to: "apns-hex-device-token",
  title: "Flash Sale",
  body: "50% off today only",
  imageUrl: "https://example.com/banner.png",
});
```

### 3. Device Token Registry

```ts
const channel = new PushChannel();
channel.registerToken("user-101", "device-token-abc");

const tokens = channel.getRegisteredTokens("user-101");
```

## Security & Validation

- **Deep Link Validation**: Deep links (`deepLink` or `data.deepLink`) are strictly validated against dangerous URI schemes (`javascript:`, `data:`, `file:`, `vbscript:`, and protocol-relative `//` URLs) to prevent injection and client-side exploitation.
- **Device Token Validation**: Device tokens are sanitized against path traversal (`..`, `/`, `\`) and control characters (`\r`, `\n`, `\0`).
