# @cognivyn/core

Central orchestration: `NotificationService`, `NotificationBuilder`, `NotificationQueue`.

```ts
import { NotificationService } from "@cognivyn/core";
import { SmsChannel } from "@cognivyn/channels";

const svc = new NotificationService().register(new SmsChannel({ provider: "mock" }));
await svc.send({ channel: "sms", to: "+1...", body: "hello" }, { fallbackChannels: ["email"] });
```
