# SMS — Twilio / MSG91 setup

```ts
import { SmsChannel, TwilioSmsProvider, Msg91SmsProvider } from "@notify/channels";
const sms = new SmsChannel({ provider: new TwilioSmsProvider(sid, token, from) });

// MSG91 (auth key + sender ID, optional route/country)
const msg91 = new SmsChannel({
  provider: new Msg91SmsProvider(process.env.MSG91_AUTH_KEY!, "SENDER", { route: "4", country: "91" }),
  retries: 1,
});
```
Numbers must be E.164. Env: `MSG91_AUTH_KEY`, `MSG91_SENDER`.
