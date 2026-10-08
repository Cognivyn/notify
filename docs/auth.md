# Auth Setup

```bash
notify auth setup sms --api-key xxx
notify auth setup email --client-id id --client-secret s
```

Env: `NOTIFY_API_KEY`, `NOTIFY_CLIENT_ID`, `NOTIFY_CLIENT_SECRET`.
`SecureStore` never logs secrets — use `describe()` / `listKeys()`.
