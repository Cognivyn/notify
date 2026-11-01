# SMS — Twilio / MSG91 setup

The SMS channel provides multi-provider SMS delivery through the `SmsProvider` adapter interface. Built-in providers include `MockSmsProvider` (for testing/development), `TwilioSmsProvider`, and `Msg91SmsProvider`.

## Quick start

```ts
import { SmsChannel, TwilioSmsProvider } from "@notify/channels";

const channel = new SmsChannel({
  provider: new TwilioSmsProvider(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!,
    process.env.TWILIO_FROM!,
  ),
  retries: 2,
});
```

### MSG91

MSG91 provides SMS delivery for India and global destinations. Supports both the official **Flow API** (`https://control.msg91.com/api/v5/flow`) for DLT-compliant template messaging with dynamic variables and short URLs, as well as the route-based SMS fallback (`https://api.msg91.com/api/v5/sms`).

#### Flow API (Template-based — Recommended)

Use this for transactional templates, OTPs, and Indian DLT compliance where a registered template ID is required.

```ts
import { SmsChannel, Msg91SmsProvider, type SmsMessage } from "@notify/channels/sms";

const msg91 = new SmsChannel({
  provider: new Msg91SmsProvider({
    authKey: process.env.MSG91_AUTH_KEY!,
    templateId: process.env.MSG91_TEMPLATE_ID!, // Default Flow / template ID
  }),
  retries: 2,
});

const message: SmsMessage = {
  channel: "sms",
  to: "+919876543210",
  body: "Your verification code is 123456",
  templateId: "65a123bc456def789", // optional per-message override
  variables: { code: "123456", name: "User" },
  shortUrl: true,
};

await msg91.send(message);
```

#### Route-Based SMS Fallback

```ts
import { SmsChannel, Msg91SmsProvider } from "@notify/channels/sms";

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
    templateId: process.env.MSG91_TEMPLATE_ID,
  }),
  retries: 2,
});
```

## Configuration & Environment Variables

| Variable            | Description                                                                      | Default        |
| ------------------- | -------------------------------------------------------------------------------- | -------------- |
| `MSG91_AUTH_KEY`    | MSG91 API authentication key (passed in `authkey` header)                        | Required       |
| `MSG91_TEMPLATE_ID` | Default template / Flow ID for Flow API delivery (`/api/v5/flow`)                | Optional       |
| `MSG91_SENDER`      | 6-character sender ID approved in MSG91 dashboard (required for route-based SMS) | Optional       |
| `MSG91_ROUTE`       | SMS delivery route (`"4"` for transactional SMS, `"1"` for promotional)          | `"4"`          |
| `MSG91_COUNTRY`     | Default country code prefix                                                      | `"91"` (India) |

## Phone Number Validation

Phone numbers must follow the E.164 standard (e.g. `+919876543210` or `+15551234567`). The provider validates the phone format with `validatePhone` and strips the leading `+` prefix when sending to the MSG91 API (`mobiles` payload field).

## Retry & Error Handling

`SmsChannel` wraps `Msg91SmsProvider` with automatic retry behavior on transient failures (network errors, rate limiting, 5xx responses). Non-recoverable errors, invalid destinations, or API error payloads (`type: "error"`, `hasError: true`) fail immediately or after configured retries.
