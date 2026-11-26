# SMS — Twilio / MSG91 / Fast2SMS setup

The SMS channel provides multi-provider SMS delivery through the `SmsProvider` adapter interface. Built-in providers include `MockSmsProvider` (for testing/development), `TwilioSmsProvider`, `Msg91SmsProvider`, and `Fast2SmsSmsProvider`.

## Quick start

```ts
import { SmsChannel, TwilioSmsProvider } from "@cognivyn/channels";

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
import { SmsChannel, Msg91SmsProvider, type SmsMessage } from "@cognivyn/channels/sms";

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
import { SmsChannel, Msg91SmsProvider } from "@cognivyn/channels/sms";

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

### Fast2SMS

Fast2SMS uses the API key directly in the `Authorization` header. The provider supports Quick SMS (`q`, the default), DLT template SMS (`dlt`), and DLT manual SMS (`dlt_manual`). DLT routes require a registered 3-6 character sender ID.

#### Quick SMS

```ts
import { SmsChannel, Fast2SmsSmsProvider } from "@cognivyn/channels/sms";

const channel = new SmsChannel({
  provider: new Fast2SmsSmsProvider({
    apiKey: process.env.FAST2SMS_API_KEY!,
    route: "q",
  }),
});

await channel.send({
  channel: "sms",
  to: "+919876543210",
  body: "Hello from Fast2SMS!",
});
```

#### DLT Template SMS

Use an approved Fast2SMS Message ID and pass variables in template order. The per-message `templateId` overrides the provider default.

```ts
const channel = new SmsChannel({
  provider: new Fast2SmsSmsProvider({
    apiKey: process.env.FAST2SMS_API_KEY!,
    route: "dlt",
    senderId: process.env.FAST2SMS_SENDER_ID!,
    templateId: process.env.FAST2SMS_TEMPLATE_ID!,
  }),
});

await channel.send({
  channel: "sms",
  to: "+919876543210",
  body: "",
  templateId: "111111",
  variables: { name: "Ada", code: "1234" }, // serialized as Ada|1234
});
```

#### DLT Manual SMS

The body must exactly match DLT-approved content. `templateId` and `entityId` may be omitted when the content template is registered in Fast2SMS DLT Manager.

```ts
const channel = new SmsChannel({
  provider: new Fast2SmsSmsProvider({
    apiKey: process.env.FAST2SMS_API_KEY!,
    route: "dlt_manual",
    senderId: process.env.FAST2SMS_SENDER_ID!,
    templateId: process.env.FAST2SMS_TEMPLATE_ID,
    entityId: process.env.FAST2SMS_ENTITY_ID,
  }),
});

await channel.send({
  channel: "sms",
  to: "+919876543210",
  body: "Your DLT-approved message",
});
```

## Configuration & Environment Variables

| Variable               | Description                                                                      | Default        |
| ---------------------- | -------------------------------------------------------------------------------- | -------------- |
| `MSG91_AUTH_KEY`       | MSG91 API authentication key (passed in `authkey` header)                        | Required       |
| `MSG91_TEMPLATE_ID`    | Default template / Flow ID for Flow API delivery (`/api/v5/flow`)                | Optional       |
| `MSG91_SENDER`         | 6-character sender ID approved in MSG91 dashboard (required for route-based SMS) | Optional       |
| `MSG91_ROUTE`          | SMS delivery route (`"4"` for transactional SMS, `"1"` for promotional)          | `"4"`          |
| `MSG91_COUNTRY`        | Default country code prefix                                                      | `"91"` (India) |
| `FAST2SMS_API_KEY`     | Fast2SMS API authorization key                                                   | Required       |
| `FAST2SMS_SENDER_ID`   | DLT-approved sender ID for `dlt` and `dlt_manual` routes                         | Optional       |
| `FAST2SMS_TEMPLATE_ID` | Default DLT Message ID or content template ID, depending on route                | Optional       |
| `FAST2SMS_ENTITY_ID`   | DLT Principal Entity ID for `dlt_manual` when not in DLT Manager                 | Optional       |

## Phone Number Validation

Phone numbers must follow the E.164 standard (e.g. `+919876543210` or `+15551234567`). MSG91 and Fast2SMS validate the phone format with `validatePhone` and strip the leading `+` prefix before sending the mobile number to their APIs.

## Retry & Error Handling

`SmsChannel` wraps each provider with automatic retry behavior on transient failures (network errors, rate limiting, 5xx responses). MSG91 API error payloads (`type: "error"`, `hasError: true`) and Fast2SMS failures (`return: false`, including HTTP-200 business errors) are surfaced as delivery errors after the configured retries.
