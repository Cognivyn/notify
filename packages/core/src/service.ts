import type {
  ChannelAdapter,
  ChannelType,
  DeliveryResult,
  NotificationPayload,
} from "@cognivyn/types";

export interface NotifyLogger {
  info(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export const noopLogger: NotifyLogger = {
  info() {},
  error() {},
};

export interface SendOptions {
  fallbackChannels?: ChannelType[];
  timeoutMs?: number;
}

export class NotificationService {
  private adapters = new Map<ChannelType, ChannelAdapter>();

  constructor(private logger: NotifyLogger = noopLogger) {}

  register(adapter: ChannelAdapter): this {
    this.adapters.set(adapter.channel, adapter);
    return this;
  }

  registered(): ChannelType[] {
    return [...this.adapters.keys()];
  }

  async send(payload: NotificationPayload, opts: SendOptions = {}): Promise<DeliveryResult> {
    const primary = this.adapters.get(payload.channel);
    if (!primary) {
      return {
        success: false,
        channel: payload.channel,
        error: `No adapter for ${payload.channel}`,
      };
    }
    try {
      const res = await this.withTimeout(primary.send(payload), opts.timeoutMs ?? 5000);
      if (res.success) return res;
      return await this.tryFallbacks(payload, opts, res.error);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error("send failed", { channel: payload.channel, msg });
      return await this.tryFallbacks(payload, opts, msg);
    }
  }

  async sendMany(payloads: NotificationPayload[], concurrency = 10): Promise<DeliveryResult[]> {
    if (payloads.length === 0) return [];
    const results: DeliveryResult[] = new Array(payloads.length);
    const limit = Math.max(1, concurrency);
    let index = 0;

    const worker = async () => {
      while (index < payloads.length) {
        const i = index++;
        results[i] = await this.send(payloads[i]);
      }
    };

    const workers = Array.from({ length: Math.min(limit, payloads.length) }, () => worker());
    await Promise.all(workers);
    return results;
  }

  private async tryFallbacks(
    payload: NotificationPayload,
    opts: SendOptions,
    primaryError?: string,
  ): Promise<DeliveryResult> {
    for (const ch of opts.fallbackChannels ?? []) {
      const adapter = this.adapters.get(ch);
      if (!adapter) continue;
      try {
        const res = await this.withTimeout(
          adapter.send({ ...payload, channel: ch }),
          opts.timeoutMs ?? 5000,
        );
        if (res.success) return res;
      } catch (e) {
        this.logger.error("fallback failed", { channel: ch, e: String(e) });
      }
    }
    return { success: false, channel: payload.channel, error: primaryError ?? "delivery failed" };
  }

  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    if (ms <= 0) return p;
    return Promise.race([
      p,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
    ]);
  }
}
