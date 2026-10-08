# API Reference

- `NotificationService.send(payload, { fallbackChannels, timeoutMs })`
- `NotificationBuilder.channel().to().body().build()`
- Channels: `SmsChannel`, `EmailChannel`, `WhatsAppChannel`, `PushChannel` — all implement `ChannelAdapter.send()`.
- `renderTemplate("Hi {{name}}", vars)`, `validatePhone`, `validateEmail`.
