import type { NotificationPayload } from "@cognivyn/types";
import { NotificationService } from "./service.js";

/** Simple in-memory batching queue. Flush sends all queued items via service. */
export class NotificationQueue {
  private items: NotificationPayload[] = [];
  constructor(
    private service: NotificationService,
    private batchSize = 10,
  ) {}

  enqueue(p: NotificationPayload): number {
    this.items.push(p);
    return this.items.length;
  }

  get size(): number {
    return this.items.length;
  }

  async flush() {
    const batch = this.items.splice(0, this.batchSize);
    if (batch.length === 0) return [];
    return this.service.sendMany(batch);
  }

  async flushAll() {
    const all = [];
    while (this.items.length > 0) {
      all.push(...(await this.flush()));
    }
    return all;
  }
}
