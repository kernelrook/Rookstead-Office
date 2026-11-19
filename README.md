# Rookstead Office Central

A browser-local launchpad for the tools you choose. This is an early Central prototype, not a complete office suite or an account service.

## Run

Requires Bun 1.4.4 (the pinned package manager). Dependencies are local to this checkout.

```sh
bun install --frozen-lockfile
bun run dev --host 0.0.0.0 --port 3000 --strictPort
```

Open the host running the server on port 3000. Use `--host 127.0.0.1` for a local-only preview. Development servers have no authentication: expose only on a trusted network. This does not configure TLS or internet hosting.

```sh
bun test src
bun run typecheck
bun run build
bun run check:privacy
```

The production build is static output in `dist/`; serve it with a static HTTP host for deployment. No database or secret environment is required.

## Use

- **Home:** arrange dashboard cards with **Edit layout**, then **Apply**. Hiding a card preserves its data. The Home focus note saves separately from Notes.
- **Navigation:** use the sidebar or **Quick find** (Cmd/Ctrl+K) to open pages and registered apps. Page links support reload and browser Back/Forward.
- **App launcher:** the grid button opens search and your registered apps. Add, edit and pin external destinations in **Settings → Manage apps**. Activity records opens from Central, not activity inside other apps.
- **Tasks, Calendar and Projects:** manage tasks, all-day events and projects. Task due dates appear on the calendar, and project progress comes from completed linked tasks.
- **Notes:** write and search browser-local notes. Unsaved drafts survive in-app page switches; choose **Save note** before closing the tab.
- **Storage:** manage files in folders with search, sorting, move, rename, download and delete. The limit is 50 MB per file, subject to browser quota. Files are not previewed or executed.
- **Messages:** a disconnected preview. No account or messaging provider is connected and nothing is sent.

## Data and limits

Data stays in the current browser and origin, including its port. There is no account, sync, telemetry or server storage. Clearing site data removes local data. Settings exports cover app registrations, launch history and preferences, not files, organizer records, dashboard layout or focus notes. Download important files separately. Keep configuration exports private: they may contain private URLs.

Suggested external apps need a destination before they can launch. Putting an external app in the launcher does not connect or inspect that service. Central validates destinations as HTTP(S) URLs without embedded credentials and does not fetch them in the background.

## Stack

React, TypeScript and Vite with exact versions and a Bun lockfile. No external fonts or icon services are loaded. Unit tests cover URL validation, atomic configuration parsing, legacy history migration, bounded launch recording, ranking/filtering, filename safety, metadata search and storage error messages. Real-browser checks exercise IndexedDB persistence and exact-byte downloads.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the public-data boundary. License is preserved in [LICENSE](LICENSE).
