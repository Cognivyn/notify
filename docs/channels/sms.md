# SMS — Twilio setup

```ts
import { SmsChannel, TwilioSmsProvider } from "@notify/channels";
const sms = new SmsChannel({ provider: new TwilioSmsProvider(sid, token, from) });
```
Numbers must be E.164.
