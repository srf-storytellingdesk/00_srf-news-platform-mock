# SRF News Platform Mock

Offline mocks of the SRG SSR article pages — **SRF, RTS, RSI, RTR and SWI** —
plus the Vite integration that drops one into a
[`00_srf-news-template`](https://github.com/srf-storytellingdesk/00_srf-news-template)
fork.

A mock is a real article page, scraped once and frozen: the full platform chrome
(header, footer, typography, dark mode) with the editorial content swapped for
placeholders and a mount point where the fork renders its own article. It needs
no network, no consent layer and no CMS.

> Successor to `00_srf-news-sandbox`. The theme generator is **not** part of
> this package — this repo does one thing: produce and serve platform mocks. See
> [MIGRATION.md](MIGRATION.md) for what changed and how to move a fork over.

## Using a mock in a fork

Add the dependency and one plugin. That is the whole integration.

```json
// package.json
{
  "config": { "sandbox": "srf" },
  "devDependencies": {
    "@srf-news/platform-mock": "git+https://github.com/srf-storytellingdesk/00_srf-news-platform-mock#main"
  }
}
```

```js
// vite.config.js
import platformMock from '@srf-news/platform-mock/vite'

import pkg from './package.json'

export default defineConfig({
  plugins: [
    platformMock({ brand: pkg.config.sandbox }),
    react(),
    // …the rest of your plugins
  ],
})
```

Then `pnpm dev`. No postinstall hook, no symlinks, nothing copied into the repo.

Add the generated entry file to the fork's `.gitignore`:

```gitignore
# written by @srf-news/platform-mock on every dev/build run
/index.html
```

### What the plugin does

|                      | dev (`vite`)                                     | build (`vite build`)        |
| -------------------- | ------------------------------------------------ | --------------------------- |
| `index.html`         | the full mock, written to the project root       | a bare mount-point document |
| `/sandbox-assets/**` | streamed out of `node_modules` by dev middleware | not emitted                 |

The build entry is deliberately minimal: forks strip the mock chrome from
`dist/` anyway, so building it would only cost time and produce a warning for
every asset URL Vite cannot resolve. Pass `buildHtml: 'mock'` if you want the
full page in the build output.

### Plugin options

| Option      | Default             | Meaning                                                                                                                                                           |
| ----------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `brand`     | `'srf'`             | `srf` \| `rts` \| `rsi` \| `rtr` \| `swi`. Falls back to `PLATFORM_MOCK_BRAND`, then `PLATFORM`.                                                                  |
| `entry`     | `null`              | Rewrites the mock's `<script type="module">` src. `null` keeps what the mock ships (`/src/index.jsx`).                                                            |
| `mountId`   | `null`              | Fills the mock's `<%= id %>`. `null` leaves it for `vite-plugin-html`.                                                                                            |
| `title`     | `null`              | Fills the mock's `<%= title %>`. Same defaulting as `mountId`.                                                                                                    |
| `htmlPath`  | `<root>/index.html` | Where the entry document is written.                                                                                                                              |
| `buildHtml` | `'minimal'`         | `'minimal'` \| `'mock'` — see the table above.                                                                                                                    |
| `assets`    | `'serve'`           | `'serve'` streams from `node_modules`; `'copy'` mirrors into `<publicDir>/sandbox-assets` (old symlink behaviour, and the only mode that puts assets in `dist/`). |
| `verbose`   | `true`              | One-line summary when the dev server starts.                                                                                                                      |

### Node API

For anything that is not Vite — a Storybook config, a test harness, a script.
Always go through this API rather than a path into `node_modules`; the package
layout is free to change, the API is not.

```js
import { BRANDS, listBrands, resolveMock } from '@srf-news/platform-mock'

const mock = resolveMock('rts')
// {
//   brand: 'rts', lang: 'fr',
//   dir:       '…/mocks/rts',
//   htmlPath:  '…/mocks/rts/index.html',
//   assetsDir: '…/mocks/rts/sandbox-assets',
//   assetsUrl: '/sandbox-assets',
//   manifest:  { …mock.json… },
// }
```

Subpath exports, if you need a raw file:
`@srf-news/platform-mock/mocks/rts/index.html`.

## Available mocks

| Brand | `<html lang>` | Interface language |
| ----- | ------------- | ------------------ |
| `srf` | `de`          | German             |
| `rts` | `fr`          | French             |
| `rsi` | `it`          | Italian            |
| `rtr` | `rm`          | Rumantsch          |
| `swi` | `en`          | English            |

A fork's rendered interface language follows the mock's `lang` attribute — the
same mechanism the CMS uses in production.

`pnpm brands` prints what is in the package, with asset counts and generation
dates. `screenshots/<brand>.png` is a full-page reference render of each.

## Maintaining this repo

```sh
pnpm install

pnpm dev                  # preview a mock (PLATFORM_MOCK_BRAND=rts pnpm dev)
pnpm brands               # list the generated mocks
pnpm mock srf             # re-scrape one brand into mocks/srf/
pnpm mock:all             # re-scrape all five
pnpm screenshot srf       # re-capture screenshots/srf.png only
pnpm check                # lint + format + test
```

### Regenerating a mock

Run it when a platform redesigns its article page, and commit the result — the
mocks are build artefacts, but they are **committed** artefacts so that
installing this package never needs a browser or a network.

```sh
pnpm mock srf             # scrape, write mocks/srf/, screenshot
pnpm mock all --no-screenshot
```

Review the screenshot diff before committing; it is the fastest way to spot a
scrape that silently lost the footer or a font.

Never hand-edit anything under `mocks/` — the next regeneration overwrites it.
Fix the brand config or the partial instead.

### Repository layout

```
integration/            Consumer-facing surface — the only supported API
  index.js              resolveMock(), listBrands(), BRANDS
  vite.js               the Vite plugin
  static-middleware.js  serves a mock's assets in dev

src/                    Generator — build-time only, never imported by a fork
  cli.js                `platform-mock` CLI
  generate.js           scrape → clean → write mocks/<brand>/
  screenshot.js         boots the preview and captures a reference PNG
  brands/               one scrape config per platform (+ _shared.js)
  partials/             markup spliced into the scraped page
  browser/              functions serialised into the scraped page
  utils/                HTML/CSS rewriting helpers

mocks/<brand>/          Generated, committed
  index.html            the frozen page
  sandbox-assets/       CSS, fonts, images it references
  mock.json             brand, lang, source URL, asset count, date

preview/                Local dev harness (stands in for a fork's entry)
screenshots/            Reference renders
```

### How a mock is built

1. Puppeteer loads `fetchUrl` from the brand config and scrolls to the bottom so
   lazy media loads.
2. Every same-origin CSS, image and font response is saved to
   `mocks/<brand>/sandbox-assets/`.
3. `deleteSelectors` strips scripts, consent tooling and anything else that
   needs a live backend.
4. `textReplacements` and `insertSelectors` replace the editorial copy with
   placeholders and splice in the partials — the template mount point
   (`{{ARTICLE_CONTENT}}`) and the top-media slot (`{{TOP_MEDIA_ELEMENT}}`).
5. All stylesheets are merged into one `merged.css`, asset URLs are rewritten to
   the `/sandbox-assets/` prefix, and referenced fonts are fetched.
6. The HTML is formatted with Prettier and written together with `mock.json`.

No editorial text survives step 4 — the mocks carry chrome and layout only.

### Adding a brand

1. Copy `src/brands/srf.js` to `src/brands/<key>.js` and adjust `fetchUrl`,
   `lang` and the selectors.
2. Add the key to `BRANDS` in [integration/index.js](integration/index.js).
3. If the platform's article markup differs, add a partial in `src/partials/`
   and point `embedTemplate` at it.
4. `pnpm mock <key>`, check the screenshot, commit.

### The `/sandbox-assets` prefix

That URL prefix is baked into every generated `index.html` and `merged.css`, so
it is part of the contract rather than an option — `ASSETS_URL` in
[integration/index.js](integration/index.js) is the single source of truth, and
a test asserts the mock HTML still agrees with it.
