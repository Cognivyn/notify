# API Reference

- `NotificationService.send(payload, { fallbackChannels, timeoutMs })`
- `NotificationBuilder.channel().to().body().build()`
- Channels: `SmsChannel`, `EmailChannel`, `WhatsAppChannel`, `PushChannel` — all implement `ChannelAdapter.send()`.
- `renderTemplate("Hi {{name}}", vars)`, `validatePhone`, `validateEmail`.

## Tree-Shakable Entrypoints

- `@notify/channels/sms` — `SmsChannel`, `TwilioSmsProvider`, `Msg91SmsProvider`, `MockSmsProvider`
- `@notify/channels/email` — `EmailChannel`, `ResendEmailProvider`, `SesEmailProvider`, `MockEmailProvider`
- `@notify/channels/whatsapp` — `WhatsAppChannel`
- `@notify/channels/push` — `PushChannel`, `FcmPushProvider`, `ApnsPushProvider`
- `@notify/core/service` — `NotificationService`
- `@notify/core/builder` — `NotificationBuilder`
- `@notify/core/queue` — `NotificationQueue`
- `@notify/auth/providers` — `ApiKeyAuth`, `ClientSecretAuth`, `createAuthProvider`
- `@notify/auth/store` — `SecureStore`
- `@notify/config/manager` — `ConfigManager`

See [docs/tree-shaking.md](./tree-shaking.md) for full guide.
