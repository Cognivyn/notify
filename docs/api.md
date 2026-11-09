# API Reference

- `NotificationService.send(payload, { fallbackChannels, timeoutMs })`
- `NotificationBuilder.channel().to().body().build()`
- Channels: `SmsChannel`, `EmailChannel`, `WhatsAppChannel`, `PushChannel` — all implement `ChannelAdapter.send()`.
- `renderTemplate("Hi {{name}}", vars)`, `validatePhone`, `validateEmail`.

## Tree-Shakable Entrypoints

- `@cognivyn/channels/sms` — `SmsChannel`, `TwilioSmsProvider`, `Msg91SmsProvider`, `MockSmsProvider`
- `@cognivyn/channels/email` — `EmailChannel`, `ResendEmailProvider`, `SesEmailProvider`, `MockEmailProvider`
- `@cognivyn/channels/whatsapp` — `WhatsAppChannel`
- `@cognivyn/channels/push` — `PushChannel`, `FcmPushProvider`, `ApnsPushProvider`
- `@cognivyn/core/service` — `NotificationService`
- `@cognivyn/core/builder` — `NotificationBuilder`
- `@cognivyn/core/queue` — `NotificationQueue`
- `@cognivyn/auth/providers` — `ApiKeyAuth`, `ClientSecretAuth`, `createAuthProvider`
- `@cognivyn/auth/store` — `SecureStore`
- `@cognivyn/config/manager` — `ConfigManager`

See [docs/tree-shaking.md](./tree-shaking.md) for full guide.
