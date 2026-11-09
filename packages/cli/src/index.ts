#!/usr/bin/env bun
import { ConfigManager } from "@cognivyn/config";
import { NotificationService } from "@cognivyn/core";
import { SmsChannel, EmailChannel, WhatsAppChannel, PushChannel } from "@cognivyn/channels";
import { SecureStore } from "@cognivyn/auth";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

const ok = (s: string) => `${GREEN}${s}${RESET}`;
const err = (s: string) => `${RED}${s}${RESET}`;
const info = (s: string) => `${CYAN}${s}${RESET}`;

function help(): string {
  return `
${info("notify")} — unified notification CLI

Usage:
  notify auth setup <channel> --api-key <key|-> | --client-id <id> --client-secret <secret|->
  notify test <channel> --to <dest> --body <msg> [--title <t>]
  notify config list
  notify config get <key>
  notify providers
  notify --help

Channels: sms, email, whatsapp, push
Exit codes: 0 ok, 1 usage error, 2 delivery failure
`.trim();
}

function parseFlags(args: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        out[k] = next;
        i++;
      } else out[k] = true;
    }
  }
  return out;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}

export async function buildService() {
  const svc = new NotificationService();
  svc.register(new SmsChannel());
  svc.register(new EmailChannel());
  svc.register(new WhatsAppChannel());
  svc.register(new PushChannel());
  return svc;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const [cmd, sub, ...rest] = argv;
  if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
    console.log(help());
    return 0;
  }
  if (cmd === "providers") {
    console.log(ok("Available providers:"));
    for (const p of [
      "sms(mock,twilio,msg91)",
      "email(mock,resend,ses)",
      "whatsapp(mock,cloudapi,twilio)",
      "push(mock,fcm,fcm-v1,apns)",
    ])
      console.log(` - ${p}`);
    return 0;
  }
  if (cmd === "config") {
    const cfg = new ConfigManager();
    if (sub === "list") {
      console.log(JSON.stringify(cfg.list(), null, 2));
      return 0;
    }
    if (sub === "get") {
      const key = rest[0];
      if (!key) {
        console.error(err("Usage: notify config get <key>"));
        return 1;
      }
      console.log(String(cfg.get(key) ?? ""));
      return 0;
    }
    console.error(err("Usage: notify config list|get"));
    return 1;
  }
  if (cmd === "auth" && sub === "setup") {
    const channel = rest[0];
    const flags = parseFlags(rest.slice(1));
    if (!channel) {
      console.error(err("Usage: notify auth setup <channel> --api-key <k|->"));
      return 1;
    }
    const store = new SecureStore();
    try {
      if (flags["api-key"]) {
        const keyVal = flags["api-key"] === "-" ? await readStdin() : String(flags["api-key"]);
        store.set(`NOTIFY_${channel.toUpperCase()}_API_KEY`, keyVal);
      } else if (flags["client-id"] && flags["client-secret"]) {
        const idVal = String(flags["client-id"]);
        const secretVal =
          flags["client-secret"] === "-" ? await readStdin() : String(flags["client-secret"]);
        store.set(`NOTIFY_${channel.toUpperCase()}_CLIENT_ID`, idVal);
        store.set(`NOTIFY_${channel.toUpperCase()}_CLIENT_SECRET`, secretVal);
      } else throw new Error("provide --api-key or --client-id + --client-secret");
      console.log(ok(`Auth configured for ${channel} (keys: ${store.listKeys().join(", ")})`));
      return 0;
    } catch (e) {
      console.error(err(e instanceof Error ? e.message : String(e)));
      return 1;
    }
  }
  if (cmd === "test") {
    const channel = sub as "sms" | "email" | "whatsapp" | "push";
    const flags = parseFlags(rest);
    const to = flags["to"] as string;
    const body = flags["body"] as string;
    const title = (flags["title"] as string) ?? "Test";
    if (!channel || !to || !body) {
      console.error(err("Usage: notify test <channel> --to <dest> --body <msg>"));
      return 1;
    }
    const svc = await buildService();
    const res = await svc.send({ channel, to, title, body });
    if (res.success) {
      console.log(ok(`Sent via ${channel}: ${res.messageId}`));
      return 0;
    }
    console.error(err(`Failed: ${res.error}`));
    return 2;
  }
  console.error(err(`Unknown command: ${cmd}\n${help()}`));
  return 1;
}

if (import.meta.main) {
  main().then((c) => process.exit(c));
}
