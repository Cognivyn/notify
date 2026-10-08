import { describe, expect, test } from "bun:test";
import { NotificationService } from "@notify/core";
import { SmsChannel } from "@notify/channels";

describe("perf benchmarks", () => {
  test("100 sms sends < 2s", async () => {
    const svc = new NotificationService().register(new SmsChannel());
    const start = Date.now();
    const ps = Array.from({ length: 100 }, (_, i) =>
      svc.send({ channel: "sms", to: "+15551234567", body: `msg ${i}` }),
    );
    const rs = await Promise.all(ps);
    const dt = Date.now() - start;
    expect(rs.filter((r) => r.success).length).toBe(100);
    expect(dt).toBeLessThan(2000);
  });
});
