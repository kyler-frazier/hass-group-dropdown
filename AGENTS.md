# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

## What this is

A Home Assistant dashboard plugin (a "Lovelace resource") with two cards: a tile with a caret, and
the list of the group's members it opens. Everything ships as one plain ES2022 script:
`group-dropdown.js`. There is no build step and there are no runtime dependencies. Keep it that
way.

## Layout

| Path                 | Purpose                                                                   |
| -------------------- | ------------------------------------------------------------------------- |
| `group-dropdown.js`  | The plugin. The only file users install.                                  |
| `tests/`             | Playwright tests (`*.spec.mjs`) and helpers.                              |
| `.hass/`             | Config for the disposable Home Assistant used by the tests.               |
| `docker-compose.yml` | Runs that Home Assistant, with this repo mounted at `/config/www/plugin`. |
| `.github/workflows/` | Lint, tests, HACS validation, release.                                    |

## Commands

```sh
npm ci
npm run check        # eslint + prettier --check
npm run hass:up      # start the test Home Assistant on :8123 (HASS_PORT to change)
npm test             # Playwright (HASS_URL to point elsewhere)
npm run hass:down
```

Run `npm run check` and `npm test` before considering a change done. `tests/internals.spec.mjs`
checks each Home Assistant internal the plugin relies on, one per test; when the plugin starts
relying on a new one, add it there. CI runs daily against stable, beta and dev (nightly) builds.
Behavior changes need a test.

## How the plugin works

- `group-dropdown-tile` wraps Home Assistant's own tile card, made from the same config, and lays
  a caret button over its end. The rest of the tile behaves as usual.
- `group-dropdown-list` is a separate card, so it can span the section under a row of half-width
  tiles. It's hidden while closed, and makes a tile for each member when opened.
- The caret fires a `group-dropdown` event on the root the tile is in (the section's, or the
  outer list's for nested groups), where the list listens. So only a list in the same section
  answers, and nested ones don't clash with the dashboard's.

## Invariants (each one has a test)

- **A closed list takes no space.** It sets `hidden` and fires `card-visibility-changed`, so Home
  Assistant hides its `hui-card` too. `connectedWhileHidden` keeps it in the page to listen.
- **The caret never runs the tile's actions.** It's a sibling of the tile, not inside it.
- **Fail loud.** A caret with no list in its section throws, rather than doing nothing.
- **Dashboards start compact.** Tiles and lists close when disconnected (leaving the view).
- **An open nested list spans every column,** and leaves no gap beside its group.
- **Rows are only rebuilt when the group's members change,** not on every state update.

## Conventions

- Prettier formatting (100 columns), ESLint recommended rules.
- Keep comments concise. A comment should explain why the code is written the way it is, not
  repeat what the code does (unless that's unobvious). If code doesn't need a comment, don't
  write one.
- [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, ...).
- Update `CHANGELOG.md` under _Unreleased_ for user-visible changes.
- Don't add dependencies to the plugin. Dev dependencies need a good reason.
