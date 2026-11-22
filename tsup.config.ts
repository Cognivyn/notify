import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    sms: "packages/channels/src/sms.ts",
    email: "packages/channels/src/email.ts",
    whatsapp: "packages/channels/src/whatsapp.ts",
    push: "packages/channels/src/push.ts",
    service: "packages/core/src/service.ts",
    builder: "packages/core/src/builder.ts",
    queue: "packages/core/src/queue.ts",
    auth: "packages/auth/src/index.ts",
    config: "packages/config/src/index.ts",
    types: "packages/types/src/index.ts",
  },
  format: ["esm"],
  dts: {
    resolve: true,
  },
  clean: true,
  sourcemap: true,
  noExternal: [/^@cognivyn\//],
});
