# SMS — Twilio / MSG91 setup

## Overview

The SMS channel provides multi-provider SMS delivery through the `SmsProvider` adapter interface. Built-in providers include `MockSmsProvider` (for testing/development), `TwilioSmsProvider`, and `Msg91SmsProvider`.

## Providers

### Twilio

```ts
import { SmsChannel, TwilioSmsProvider } from "@notify/channels";

const twilio = new SmsChannel({
  provider: new TwilioSmsProvider(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!,
    process.env.TWILIO_FROM!,
  ),
  retries: 2,
});
```

### MSG91

MSG91 provides SMS delivery for India and global destinations. Supports authentication via `authkey` header and customizable route/country configurations.

#### Options Object Initialization

```ts
import { SmsChannel, Msg91SmsProvider } from "@notify/channels";

const msg91 = new SmsChannel({
  provider: new Msg91SmsProvider({
    authKey: process.env.MSG91_AUTH_KEY!,
    sender: process.env.MSG91_SENDER!,
    route: process.env.MSG91_ROUTE ?? "4",
    country: process.env.MSG91_COUNTRY ?? "91",
  }),
  retries: 2,
});

await msg91.send({
  channel: "sms",
  to: "+919876543210",
  body: "Hello from Cognivyn Notify!",
});
```

#### Positional Arguments Initialization

```ts
const msg91 = new SmsChannel({
  provider: new Msg91SmsProvider(process.env.MSG91_AUTH_KEY!, process.env.MSG91_SENDER!, {
    route: "4",
    country: "91",
  }),
  retries: 2,
});
```

## Configuration & Environment Variables

| Variable         | Description                                                             | Default        |
| ---------------- | ----------------------------------------------------------------------- | -------------- |
| `MSG91_AUTH_KEY` | MSG91 API authentication key (passed in `authkey` header)               | Required       |
| `MSG91_SENDER`   | 6-character sender ID approved in MSG91 dashboard                       | Required       |
| `MSG91_ROUTE`    | SMS delivery route (`"4"` for transactional SMS, `"1"` for promotional) | `"4"`          |
| `MSG91_COUNTRY`  | Default country code prefix                                             | `"91"` (India) |

## Phone Number Validation

Phone numbers must follow the E.164 standard (e.g. `+919876543210` or `+15551234567`). The provider validates the phone format with `validatePhone` and strips the leading `+` prefix when sending to the MSG91 API (`mobiles` payload field).

## Retry & Error Handling

`SmsChannel` wraps `Msg91SmsProvider` with automatic retry behavior on transient failures (network errors, rate limiting, 5xx responses). Non-recoverable errors or invalid destinations fail immediately.
