/**
 * Demonstrates configuration and usage of all modern channel providers supported by @cognivyn/notify.
 */
import {
  SmsChannel,
  TwilioSmsProvider,
  Msg91SmsProvider,
  EmailChannel,
  ResendEmailProvider,
  SesEmailProvider,
  WhatsAppChannel,
  WhatsAppCloudApiProvider,
  TwilioWhatsAppProvider,
  PushChannel,
  FcmV1PushProvider,
  ApnsPushProvider,
} from "@cognivyn/channels";
import { NotificationService } from "@cognivyn/core";

// 1. SMS Channel (Twilio or MSG91 Flow API)
const sms = new SmsChannel({
  provider: process.env.TWILIO_ACCOUNT_SID
    ? new TwilioSmsProvider(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN!,
        process.env.TWILIO_FROM!,
      )
    : new Msg91SmsProvider({
        authKey: process.env.MSG91_AUTH_KEY ?? "dummy_key",
        templateId: process.env.MSG91_TEMPLATE_ID,
      }),
});

// 2. Email Channel (Resend or AWS SESv2 with SigV4)
const email = new EmailChannel({
  provider: process.env.RESEND_API_KEY
    ? new ResendEmailProvider(process.env.RESEND_API_KEY, "noreply@acme.com")
    : new SesEmailProvider({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "dummy_akid",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "dummy_secret",
        region: process.env.AWS_REGION ?? "us-east-1",
        from: "noreply@acme.com",
      }),
});

// 3. WhatsApp Channel (Meta WhatsApp Cloud API v21.0 or Twilio WhatsApp)
const whatsapp = new WhatsAppChannel({
  provider: process.env.WHATSAPP_ACCESS_TOKEN
    ? new WhatsAppCloudApiProvider({
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
      })
    : new TwilioWhatsAppProvider({
        accountSid: process.env.TWILIO_ACCOUNT_SID ?? "AC1234567890abcdef",
        authToken: process.env.TWILIO_AUTH_TOKEN ?? "dummy_token",
        from: "+14155238886",
      }),
});

// 4. Push Channel (Google FCM HTTP v1 or Apple APNs)
const push = new PushChannel({
  provider: process.env.FIREBASE_PROJECT_ID
    ? new FcmV1PushProvider({
        projectId: process.env.FIREBASE_PROJECT_ID,
        accessToken: process.env.GOOGLE_OAUTH_ACCESS_TOKEN ?? "dummy_bearer",
      })
    : new ApnsPushProvider({
        providerToken: process.env.APNS_PROVIDER_TOKEN ?? "dummy_jwt",
        bundleId: "com.acme.app",
        production: true,
      }),
});

// Orchestrate with NotificationService
const notifyService = new NotificationService()
  .register(sms)
  .register(email)
  .register(whatsapp)
  .register(push);

console.log("Registered providers:", {
  sms: sms.providerName,
  email: email.providerName,
  whatsapp: whatsapp.providerName,
  push: push.providerName,
});
