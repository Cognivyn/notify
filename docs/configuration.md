# Configuration

`ConfigManager` reads constructor values + `NOTIFY_*` env vars.

```ts
import { ConfigManager } from "@notify/config";
const cfg = new ConfigManager({ "sms.from": "+1555..." });
cfg.get("NOTIFY_API_KEY");
```

See `.env.example`.
