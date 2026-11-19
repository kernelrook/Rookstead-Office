# Contributing

Keep this public project independent of private workspaces and infrastructure.

- Use only original or appropriately licensed source. Preserve LICENSE.
- Never add credentials, environment files, personal identities, internal hostnames, private addresses, runtime paths, browser exports, local data or real service inventories.
- Use generic examples such as `https://example.com`. Keep browser evidence and runtime logs outside the checkout. Inspect screenshots before sharing.
- Run tests, typecheck, build and `bun run check:privacy` before proposing changes. The checker is a heuristic, not a security guarantee; also review diffs and new files manually.
- Add regression tests before changing model behavior. Keep catalogue suggestions clearly distinct from working modules.
- Do not commit build output, dependencies or user configuration. Do not push or publish without explicit authorization from the repository owner.
