# @cognivyn/auth

Flexible, secure authentication for all channels.

```ts
import { ApiKeyAuth, ClientSecretAuth, SecureStore } from "@cognivyn/auth";

const api = new ApiKeyAuth(process.env["NOTIFY_API_KEY"]!);
const oauth = ClientSecretAuth.fromEnv();
const store = new SecureStore();
store.set("NOTIFY_API_KEY", "xxx");
```

- `ApiKeyAuth` — `Authorization: Bearer <key>`
- `ClientSecretAuth` — `Authorization: Basic base64(id:secret)`
- `SecureStore` — memory + env fallback, never logs secrets
- Env vars: `NOTIFY_API_KEY`, `NOTIFY_CLIENT_ID`, `NOTIFY_CLIENT_SECRET`
