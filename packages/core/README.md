# @notify/core

Central orchestration: `NotificationService`, `NotificationBuilder`, `NotificationQueue`.

```ts
import { NotificationService } from "@notify/core";
import { SmsChannel } from "@notify/channels";

const svc = new NotificationService().register(new SmsChannel({ provider: "mock" }));
await svc.send({ channel: "sms", to: "+1...", body: "hello" }, { fallbackChannels: ["email"] });
```
