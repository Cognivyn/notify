import type { ChannelType, NotificationPayload } from "@cognivyn/types";

/** Type-safe notification builder. */
export class NotificationBuilder {
  private payload: Partial<NotificationPayload> = {};

  channel(c: ChannelType): this {
    this.payload.channel = c;
    return this;
  }
  to(to: string): this {
    this.payload.to = to;
    return this;
  }
  title(title: string): this {
    this.payload.title = title;
    return this;
  }
  body(body: string): this {
    this.payload.body = body;
    return this;
  }
  data(data: Record<string, unknown>): this {
    this.payload.data = { ...(this.payload.data ?? {}), ...data };
    return this;
  }
  build(): NotificationPayload {
    const { channel, to, body } = this.payload;
    if (!channel) throw new Error("channel is required");
    if (!to) throw new Error("to is required");
    if (!body) throw new Error("body is required");
    return this.payload as NotificationPayload;
  }
}

export function notify(channel: ChannelType, to: string, body: string): NotificationPayload {
  return new NotificationBuilder().channel(channel).to(to).body(body).build();
}
