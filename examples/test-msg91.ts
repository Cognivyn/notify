import { Msg91SmsProvider, SmsChannel } from "../packages/channels/src/sms";

const authKey = process.env.MSG91_AUTH_KEY;
const sender = process.env.MSG91_SENDER;
const templateId = process.env.MSG91_TEMPLATE_ID;

if (!authKey) {
  console.error("MSG91_AUTH_KEY missing in env");
  process.exit(1);
}

const provider = new Msg91SmsProvider({
  authKey,
  sender,
  templateId,
  route: process.env.MSG91_ROUTE || "4",
  country: process.env.MSG91_COUNTRY || "91",
});

const channel = new SmsChannel({ provider });

const to = process.argv[2];
const varsArg = process.argv[3];

if (!to) {
  console.error("Usage: bun --env-file=.env.local examples/test-msg91.ts <to> '<variables-json>'");
  console.error("Example (preapproved Flow template): bun --env-file=.env.local examples/test-msg91.ts +919876543210 '{\"VAR1\":\"123456\"}'");
  console.error("Example (route-based SMS): MSG91_SENDER required, pass body as 3rd arg only if not using template");
  process.exit(1);
}

let variables: Record<string, string | number> | undefined;
if (varsArg) {
  try {
    variables = JSON.parse(varsArg);
  } catch {
    console.error("variables must be valid JSON (e.g. '{\"VAR1\":\"123456\"}')");
    process.exit(1);
  }
}

try {
  const result = await channel.send({
    channel: "sms",
    to,
    body: "", // Not used for preapproved Flow API templates
    ...(templateId ? { templateId, variables } : {}),
    ...(variables && !templateId ? { variables } : {}),
  });
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
}
