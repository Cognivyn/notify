# Architecture

```
@notify/types → @notify/config, @notify/auth → @notify/core → @notify/channels → @notify/cli
```

- SRP: one class per concern, provider adapters per channel.
- `NotificationService` routes by `payload.channel`, supports `fallbackChannels` + timeout.
- `NotificationQueue` batches; `NotificationBuilder` is type-safe.
- No heavy deps; `fetch` injected for testability.
