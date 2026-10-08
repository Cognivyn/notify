# Push — mock / FCM / APNs

```ts
import { PushChannel, FcmPushProvider, ApnsPushProvider } from "@notify/channels";

channel.registerToken("user1", "device-token");
await channel.send({ channel: "push", to: "device-token", title: "Hi", body: "hello", data: { deepLink: "/orders/1" } });

// FCM (server key; image + data supported)
const fcm = new PushChannel(new FcmPushProvider(process.env.FCM_SERVER_KEY!));
await fcm.send({ channel: "push", to: "device-token", title: "Hi", body: "hello" });

// APNs (ES256 provider JWT + bundle id; production flag selects the host)
const apns = new PushChannel(
  new ApnsPushProvider({ providerToken: process.env.APNs_PROVIDER_TOKEN!, bundleId: "com.acme.app", production: true }),
);
await apns.send({ channel: "push", to: "device-token", title: "Hi", body: "hello" });
```
Env: `FCM_SERVER_KEY`, `APNS_PROVIDER_TOKEN`, `APNS_BUNDLE_ID`. Generate the APNs JWT from your Apple Developer key and pass it as `providerToken`.
