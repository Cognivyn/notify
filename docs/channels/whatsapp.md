# WhatsApp — Cloud API (Meta) / Twilio / Mock

The WhatsApp channel provides multi-provider messaging through the `WhatsAppProvider` adapter interface. Built-in providers include `MockWhatsAppProvider` (for testing/development), `WhatsAppCloudApiProvider` (Meta Graph API v21.0+), and `TwilioWhatsAppProvider`.

## Quick start

### 1. Meta WhatsApp Cloud API (Recommended)

Official Meta WhatsApp Business Cloud API (Graph API v21.0+). Supports text messages with link previews, registered template messages with dynamic components, and media attachments.

```ts
import {
  WhatsAppChannel,
  WhatsAppCloudApiProvider,
  type WhatsAppMessage,
} from "@cognivyn/channels/whatsapp";

const channel = new WhatsAppChannel({
  provider: new WhatsAppCloudApiProvider({
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
    apiVersion: "v21.0", // defaults to "v21.0"
  }),
  retries: 2,
});

// Text message
await channel.send({
  channel: "whatsapp",
  to: "+15551234567",
  body: "Hello from Cognivyn Notify!",
  previewUrl: true,
});

// Official Template message
await channel.send({
  channel: "whatsapp",
  to: "+15551234567",
  body: "",
  templateName: "order_update",
  languageCode: "en_US",
  components: [
    {
      type: "body",
      parameters: [{ type: "text", text: "Order #98765" }],
    },
  ],
});

// Media message (image, document, audio, video)
await channel.send({
  channel: "whatsapp",
  to: "+15551234567",
  body: "Your monthly invoice",
  mediaUrl: "https://example.com/invoice.pdf",
  mediaType: "document",
});
```

### 2. Twilio WhatsApp

Twilio Programmable Messaging API for WhatsApp. Automatically handles the `whatsapp:` URI prefix for both `To` and `From` numbers and HTTP Basic auth.

```ts
import { WhatsAppChannel, TwilioWhatsAppProvider } from "@cognivyn/channels/whatsapp";

const channel = new WhatsAppChannel({
  provider: new TwilioWhatsAppProvider({
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    from: process.env.TWILIO_WHATSAPP_FROM!, // e.g. "+14155238886" or "whatsapp:+14155238886"
  }),
  retries: 2,
});

await channel.send({
  channel: "whatsapp",
  to: "+15551234567",
  body: "Hello via Twilio WhatsApp!",
  mediaUrl: "https://example.com/logo.png",
});
```

### 3. Mock Provider (Testing & Development)

```ts
import { WhatsAppChannel, MockWhatsAppProvider } from "@cognivyn/channels/whatsapp";

const channel = new WhatsAppChannel(new MockWhatsAppProvider());
await channel.send({
  channel: "whatsapp",
  to: "+15551234567",
  body: "Test message",
});
```

## Template Interpolation

For simple inline templating without registered Meta templates, you can supply `template` with `{{body}}`:

```ts
await channel.send({
  channel: "whatsapp",
  to: "+15551234567",
  body: "Your code is 456789",
  template: "Security Notice: {{body}}. Do not share this with anyone.",
});
```

## Validation & Security

- Phone numbers are validated against the E.164 specification (`^\+[1-9]\d{7,14}$`).
- Media URLs must use `http` or `https` protocols and are sanitized against CRLF header injection.
- Template interpolation prevents RegExp replacement pattern injection ($&, $`, etc.).
