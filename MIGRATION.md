# Migrating a fork from `00_srf-news-sandbox`

This package replaces the sandbox repo's template half. The mocks themselves are
byte-identical to what `00_srf-news-sandbox` generated — only the way a fork
gets at them changed.

## What changed, and why

### The old setup

```
00_srf-news-template
├── package.json          dependency: 00_srf-news-sandbox (whole repo, #main)
│                         config.sandbox: "srf"
│                         postinstall: node ./src/scripts/utils/setup-sandbox.js
├── index.html         →  /Users/you/Dev/00_srf-news-template/node_modules/
│                         00_srf-news-sandbox/template/srf/index.html
└── public/
    └── sandbox-assets →  …/00_srf-news-sandbox/template/srf/public/sandbox-assets
```

Five problems, all of them structural:

1. **Deep reach-in.** `setup-sandbox.js` hardcoded
   `node_modules/00_srf-news-sandbox/template/<brand>/…`. Any reorganisation of
   the sandbox repo broke every fork at once, and there was no way to tell which
   parts of its layout were public and which were internal.
2. **Absolute symlinks.** The links stored machine-specific paths, so a fork's
   working tree was not portable — CI, Docker, a colleague's checkout and
   Windows all needed the postinstall to have run on that exact machine.
3. **A postinstall hook** was required for the project to work at all, which in
   turn needed `blockExoticSubdeps=false` in `.pnpmrc`.
4. **Switching brands meant reinstalling.** `config.sandbox` was only read by
   the postinstall, so changing brand meant `pnpm install`, not a restart.
5. **The mock chrome went through the production build** and had to be deleted
   again afterwards by `newsSrfSandboxExcludePlugin`.

### The new setup

One plugin in `vite.config.js`. Nothing in the working tree but a gitignored
`index.html`, and Vite serves the assets straight out of `node_modules`.

```
00_srf-news-template
├── package.json          devDependency: @srf-news/platform-mock
│                         config.sandbox: "srf"     (no postinstall)
├── vite.config.js        plugins: [platformMock({ brand: … }), …]
└── index.html            generated each run, gitignored
```

|                           | before                | after                           |
| ------------------------- | --------------------- | ------------------------------- |
| Path into the dependency  | hardcoded in the fork | `resolveMock()` / `exports` map |
| Files in the working tree | 2 absolute symlinks   | 1 generated `index.html`        |
| Install hook              | postinstall required  | none                            |
| Switching brand           | edit + `pnpm install` | edit + restart dev server       |
| Mock chrome in `dist/`    | built, then deleted   | never built                     |
| Portable across machines  | no                    | yes                             |

## Steps

### 1. Swap the dependency

```diff
   "devDependencies": {
-    "00_srf-news-sandbox": "git+https://github.com/srf-storytellingdesk/00_srf-news-sandbox#main"
+    "@srf-news/platform-mock": "git+https://github.com/srf-storytellingdesk/00_srf-news-platform-mock#main"
   }
```

`config.sandbox` stays exactly as it is — the brand keys are unchanged.

### 2. Drop the postinstall hook

```diff
   "scripts": {
-    "postinstall": "node ./src/scripts/utils/setup-sandbox.js"
   }
```

Then delete `src/scripts/utils/setup-sandbox.js`. If `.pnpmrc` only carried
`blockExoticSubdeps=false` for it, that can go too.

### 3. Add the plugin

```diff
+ import platformMock from '@srf-news/platform-mock/vite'
+
- import { name } from './package.json'
+ import pkg from './package.json'
+
+ const { name } = pkg

  export default defineConfig({
    plugins: [
+     platformMock({ brand: pkg.config.sandbox }),
      react(),
      createHtmlPlugin({ … }),
```

Put it first: it writes the entry HTML before Vite reads it, and its `<%= id %>`
/ `<%= title %>` placeholders are still filled in by `createHtmlPlugin` exactly
as before.

### 4. Clean up the symlinks and `.gitignore`

```sh
rm -f index.html
rm -rf public/sandbox-assets
```

`.gitignore` keeps `/index.html`, and `public/sandbox-assets` is no longer
created at all — that line can stay as a harmless leftover or be removed.

### 5. Optional: drop the exclude plugin

`newsSrfSandboxExcludePlugin` deleted `dist/index.html` and
`dist/sandbox-assets/` after every build. With `buildHtml: 'minimal'` (the
default) the mock chrome never enters the build, so the plugin has nothing left
to remove.

Keep it if something downstream relies on `dist/index.html` being absent —
`vite build` still writes a small one, and the exclude plugin still removes it.

### 6. Verify

```sh
pnpm install
pnpm dev            # platform chrome around your article, no 404s
pnpm build          # check dist/ contains no sandbox-assets/
```

The dev server logs which mock it picked up:

```
➜  platform mock: srf (lang de, generated 2026-09-01) — assets streamed from node_modules
```

## Switching brands

Same as before — `config.sandbox` in `package.json` — but a dev-server restart
is now enough, no reinstall. `pnpm run translate` needs one adjustment: it can
stop running `pnpm i` after changing `config.sandbox`.

Per-run override without touching `package.json`:

```sh
PLATFORM_MOCK_BRAND=rts pnpm dev
```

## If you need the old behaviour

`assets: 'copy'` reproduces the symlink setup as a real copy — assets are
mirrored into `public/sandbox-assets` and become part of the build output:

```js
platformMock({ brand: pkg.config.sandbox, assets: 'copy', buildHtml: 'mock' })
```

Add `public/sandbox-assets` back to `.gitignore` if you use it.

## What is not here

The **theme generator** (`pnpm theme`, `theme-override/themeVariables.scss`, the
`_newsColors.scss` lookup) was deliberately left out of this package. It scrapes
dark-mode CSS and emits SCSS for the template's
`cmsOverrides/themeVariables.scss` — a different job with a different output,
and it reached back into `00_srf-news-template` to read its colour variables.

It still lives in `00_srf-news-sandbox`. Keep that repo checked out for theme
work, or move the generator into the template repo itself, where the SCSS it
reads and writes already lives.
