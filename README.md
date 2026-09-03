# SRF News Platform Mock

Offline mocks of the SRG SSR article pages — **SRF, RTS, RSI, RTR and SWI** —
plus the Vite integration that drops one into a
[`00_srf-news-template`](https://github.com/srf-storytellingdesk/00_srf-news-template)
fork.

A mock is a real article page, scraped once and frozen: the full platform chrome
(header, footer, typography, dark mode) with the editorial content swapped for
placeholders and a mount point where the fork renders its own article. It needs
no network, no consent layer and no CMS.

> This repo is not published to a registry — forks install it straight from git.
> The theme generator is **not** part of it: this repo does one thing, produce
> and serve platform mocks. See [MIGRATION.md](MIGRATION.md) for what changed
> and how to move a fork over.

## Using a mock in a fork

Add the dependency and one plugin. That is the whole integration.

```json
// package.json
{
  "config": { "mock": "srf" },
  "devDependencies": {
    "00_srf-news-platform-mock": "github:srf-storytellingdesk/00_srf-news-platform-mock#2026-09-02"
  }
}
```

Pin the date tag of a regeneration, never `#main`. Every push of regenerated
mocks is tagged with the day it was published, `YYYY-MM-DD` — see
[Tagging a regeneration](#tagging-a-regeneration). The tag is what makes a
fork's platform chrome stable: it changes when someone edits that date, and at
no other time. `#main` would hand each install whatever was scraped last, so two
machines could render the same article in different chrome.

```js
// vite.config.js
import platformMock from '00_srf-news-platform-mock/vite'

import pkg from './package.json'

export default defineConfig({
  plugins: [
    platformMock({ brand: pkg.config.mock }),
    react(),
    // …the rest of your plugins
  ],
})
```

Then `pnpm dev`. No postinstall hook, no symlinks, nothing copied into the repo.

Add the generated entry file to the fork's `.gitignore`:

```gitignore
# written by 00_srf-news-platform-mock on every dev/build run
/index.html
```

### Moving a fork to newer mocks

Bump the date in the dependency spec and reinstall:

```sh
git ls-remote --tags https://github.com/srf-storytellingdesk/00_srf-news-platform-mock
# edit package.json, then
pnpm install
```

Nothing else changes — brand keys, the plugin call and the asset URLs are the
same across regenerations. The dev server prints which mock it loaded and when
that mock was scraped, so a glance at the startup line confirms the bump landed.

### What the plugin does

|                   | dev (`vite`)                                     | build (`vite build`)                  |
| ----------------- | ------------------------------------------------ | ------------------------------------- |
| `index.html`      | the full mock, written to the project root       | a bare entry, written but not emitted |
| `/mock-assets/**` | streamed out of `node_modules` by dev middleware | not emitted                           |

`dist/` therefore holds nothing but the fork's own bundle. Vite needs an entry
document to build from, so the plugin still writes the bare mount-point version
to the project root — it just drops it from the output again, before it reaches
disk. That is what a fork wants: the bundle is embedded into a CMS article, and
an `index.html` in the build output only has to be deleted again before upload.

Pass `buildHtml: 'minimal'` to keep that bare document in `dist/` (which is what
`vite preview` needs), or `buildHtml: 'mock'` for the full platform page.

### Plugin options

| Option      | Default             | Meaning                                                                                                                                                        |
| ----------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `brand`     | `'srf'`             | `srf` \| `rts` \| `rsi` \| `rtr` \| `swi`. Falls back to `PLATFORM_MOCK_BRAND`, then `PLATFORM`.                                                               |
| `entry`     | `null`              | Rewrites the mock's `<script type="module">` src. `null` keeps what the mock ships (`/src/index.jsx`).                                                         |
| `mountId`   | `null`              | Fills the mock's `<%= id %>`. `null` leaves it for `vite-plugin-html`.                                                                                         |
| `title`     | `null`              | Fills the mock's `<%= title %>`. Same defaulting as `mountId`.                                                                                                 |
| `htmlPath`  | `<root>/index.html` | Where the entry document is written.                                                                                                                           |
| `buildHtml` | `'none'`            | `'none'` \| `'minimal'` \| `'mock'` — what ends up in `dist/`, see the table above.                                                                            |
| `assets`    | `'serve'`           | `'serve'` streams from `node_modules`; `'copy'` mirrors into `<publicDir>/mock-assets` (old symlink behaviour, and the only mode that puts assets in `dist/`). |
| `verbose`   | `true`              | One-line summary when the dev server starts.                                                                                                                   |

### Injected constants

The plugin contributes three compile-time constants through Vite's `define`, so
a fork can branch on the mocked platform without restating what this package
already knows:

| Constant               | Example                                    | Meaning                                                |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------ |
| `__MOCK_PLATFORM__`    | `'srf'`                                    | Brand key the plugin was configured with.              |
| `__MOCK_LANG__`        | `'de'`                                     | The mock's `<html lang>`.                              |
| `__MOCK_ENTRY_POINT__` | `'[data-news-landmark="article-content"]'` | Selector of the article mount point, from `mock.json`. |

The last one is the useful one: a fork that inserts its own elements into the
article body — dev-only portal containers, say — can query for the mount point
instead of keeping a copy of every brand's selector next to its own code.

### Node API

For anything that is not Vite — a Storybook config, a test harness, a script.
Always go through this API rather than a path into `node_modules`; the repo
layout is free to change, the API is not.

```js
import { BRANDS, listBrands, resolveMock } from '00_srf-news-platform-mock'

const mock = resolveMock('rts')
// {
//   brand: 'rts', lang: 'fr',
//   dir:       '…/mocks/rts',
//   htmlPath:  '…/mocks/rts/index.html',
//   assetsDir: '…/mocks/rts/mock-assets',
//   assetsUrl: '/mock-assets',
//   manifest:  { …mock.json… },
// }
```

Subpath exports, if you need a raw file:
`00_srf-news-platform-mock/mocks/rts/index.html`.

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

`pnpm brands` prints what is in this repo, with asset counts and generation
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
installing this repo as a dependency never needs a browser or a network.

```sh
pnpm mock srf             # scrape, write mocks/srf/, screenshot
pnpm mock all --no-screenshot
```

Review the screenshot diff before committing; it is the fastest way to spot a
scrape that silently lost the footer or a font.

Never hand-edit anything under `mocks/` — the next regeneration overwrites it.
Fix the brand config or the partial instead.

### Tagging a regeneration

Regenerated mocks are committed and pushed as one unit, and that push is tagged
with the day's date. The tag is the only thing forks depend on, so a push that
changes `mocks/` without one is invisible to them.

```sh
pnpm mock:all                       # scrape all five, screenshot each
git add mocks screenshots
git commit -m "regenerate mocks"
git tag 2026-09-02                  # today, YYYY-MM-DD
git push origin main 2026-09-02
```

- **One tag per push.** A second regeneration on the same day gets a counter:
  `2026-09-02.2`, then `.3`.
- **Never move or delete a published tag.** A fork resolves it to a commit once
  and records that commit in its lockfile; repointing the tag means two forks
  install different mocks from an identical dependency spec.
- **The tag is this repo's version.** `package.json`'s `version` is not
  maintained — there is nothing to publish it to.
- A tag is also worth pushing after a change to `integration/` that forks need,
  even when no mock was rescraped. Same format, same rules.

`pnpm brands` and each `mock.json`'s `generatedAt` record when a mock was
scraped; the tag records when it was published to forks. The two differ whenever
a scrape is reviewed for a day or two before it goes out.

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
  mock-assets/          CSS, fonts, images it references
  mock.json             brand, lang, entry point selector, source URL, assets, date

preview/                Local dev harness (stands in for a fork's entry)
screenshots/            Reference renders
```

### How a mock is built

1. Puppeteer loads `fetchUrl` from the brand config and scrolls to the bottom so
   lazy media loads.
2. Every same-origin CSS, image and font response is saved to
   `mocks/<brand>/mock-assets/`.
3. `deleteSelectors` strips scripts, consent tooling and anything else that
   needs a live backend.
4. `mounts` splices the partials into the page — the `article` mount a template
   fork renders into, and the optional `topMedia` slot — and `textReplacements`
   swaps the editorial copy for placeholders. `mounts.article.selector` is what
   `mock.json` records as `entryPointSelector`.
5. All stylesheets are merged into one `merged.css`, asset URLs are rewritten to
   the `/mock-assets/` prefix, and referenced fonts are fetched.
6. The HTML is formatted with Prettier and written together with `mock.json`.

No editorial text survives step 4 — the mocks carry chrome and layout only.

### Adding a brand

1. Copy `src/brands/srf.js` to `src/brands/<key>.js` and adjust `fetchUrl`,
   `lang` and the selectors.
2. Add the key to `BRANDS` in [integration/index.js](integration/index.js).
3. If the platform's article markup differs, add a partial in `src/partials/`
   and point `mounts.article.template` at it.
4. `pnpm mock <key>`, check the screenshot, commit.

### The `/mock-assets` prefix

That URL prefix is baked into every generated `index.html` and `merged.css`, so
it is part of the contract rather than an option — `ASSETS_URL` in
[integration/index.js](integration/index.js) is the single source of truth, and
a test asserts the mock HTML still agrees with it.
