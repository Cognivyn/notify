# Contributing

1. Branch `feat/<issue>-<slug>`, one PR per issue.
2. `bun install`, `bun run format:check`, `bun run build`, `bun run type-check`, `bun test`.
3. Keep SRP, add tests, never log secrets.
4. Run the full gate before every PR: `bun run format:check && bun run build && bun run type-check && bun test`.
