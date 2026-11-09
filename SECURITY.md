# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |

## Reporting a vulnerability

Do **not** open a public GitHub issue for security vulnerabilities.

Please report privately via [GitHub security advisories](https://github.com/Cognivyn/notify/security/advisories/new).

Include as much of the following as possible:

- Affected package(s) (`@cognivyn/*` or `@cognivyn/notify`) and version
- Reproduction steps or a proof of concept
- Impact assessment

## Response targets

- Acknowledgement: within 2 business days
- Assessment and fix timeline: within 30 days for confirmed issues
- Coordinated disclosure once a patch is released

## Scope

Out of scope: vulnerabilities in the upstream provider APIs themselves (Twilio, MSG91, Resend, SES, WhatsApp Cloud API, FCM, APNs) — report those to the respective vendors.

## Handling secrets

Credentials never belong in the repository. Configure them via environment variables (see `.env.example`) or `notify auth setup <channel> --api-key -` (stdin). Never commit or paste live keys.
