# Push — FCM / APNs concepts

```ts
channel.registerToken("user1", "device-token");
await channel.send({ channel: "push", to: "device-token", title: "Hi", body: "hello", data: { deepLink: "/orders/1" } });
```
