# Architecture

```
@cognivyn/types → @cognivyn/config, @cognivyn/auth → @cognivyn/core → @cognivyn/channels → @cognivyn/cli
```

- SRP: one class per concern, provider adapters per channel.
- `NotificationService` routes by `payload.channel`, supports `fallbackChannels` + timeout.
- `NotificationQueue` batches; `NotificationBuilder` is type-safe.
- No heavy deps; `fetch` injected for testability.
- Tree-shakable package manifests: `sideEffects: false`, subpath exports maps, and emitted `dist/` artifacts. See [docs/tree-shaking.md](./tree-shaking.md).
