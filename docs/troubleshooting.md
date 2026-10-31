# Troubleshooting

- `No adapter for X` → register channel.
- `Invalid E.164` → use `+<country><number>`.
- `Invalid email` → check format.
- Twilio 4xx → verify sid/token/from.
- MSG91 error → verify `authkey`, sender ID, and recipient phone format.
- Timeout → increase `timeoutMs` or check provider.
