# Migrating a fork to the platform-mock plugin

This repo replaces the template half of the old sandbox dependency. The mocks
themselves are byte-identical to the ones a fork got before — only the way a
fork gets at them changed.

## What changed, and why

### The old setup

```
00_srf-news-template
├── package.json          dependency: the sandbox repo (whole repo, #main)
│                         config.sandbox: "srf"
│                         postinstall: node ./src/scripts/utils/setup-sandbox.js
├── index.html         →  absolute symlink into node_modules/…/template/srf/index.html
└── public/
    └── sandbox-assets →  absolute symlink into …/template/srf/public/sandbox-assets
```

Five problems, all of them structural:

1. **Deep reach-in.** `setup-sandbox.js` hardcoded a path through
   `node_modules/<dependency>/template/<brand>/…`. Any reorganisation of the
   dependency broke every fork at once, and there was no way to tell which parts
   of its layout were public and which were internal.
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
├── package.json          devDependency: 00_srf-news-platform-mock
│                         config.mock: "srf"        (no postinstall)
├── vite.config.js        plugins: [platformMock({ brand: … }), …]
└── index.html            generated each run, gitignored
```

|                           | before                | after                           |
| ------------------------- | --------------------- | ------------------------------- |
| Path into the dependency  | hardcoded in the fork | `resolveMock()` / `exports` map |
| Files in the working tree | 2 absolute symlinks   | 1 generated `index.html`        |
| Brand field               | `config.sandbox`      | `config.mock`                   |
| Install hook              | postinstall required  | none                            |
| Switching brand           | edit + `pnpm install` | edit + restart dev server       |
| Mock chrome in `dist/`    | built, then deleted   | never built                     |
| Portable across machines  | no                    | yes                             |

## Steps

### 1. Swap the dependency

Replace the old sandbox entry in `devDependencies` with:

```json
{
  "devDependencies": {
    "00_srf-news-platform-mock": "github:srf-storytellingdesk/00_srf-news-platform-mock#2026-09-02"
  }
}
```

Still a plain git dependency — this repo is not published to a registry, so
there is nothing to authenticate against. The date tag is its version: every
push of regenerated mocks is tagged `YYYY-MM-DD`, and a fork pins one of those
instead of `#main` so its platform chrome cannot change under it. Pick the
newest one:

```sh
git ls-remote --tags https://github.com/srf-storytellingdesk/00_srf-news-platform-mock
```

### 2. Rename the brand field

The brand keys are unchanged — only the field that holds them:

```diff
   "config": {
-    "sandbox": "srf"
+    "mock": "srf"
   }
```

If `pnpm run translate` writes that field, point it at the new name too.

### 3. Drop the postinstall hook

```diff
   "scripts": {
-    "postinstall": "node ./src/scripts/utils/setup-sandbox.js"
   }
```

Then delete `src/scripts/utils/setup-sandbox.js`. If `.pnpmrc` only carried
`blockExoticSubdeps=false` for it, that can go too.

### 4. Add the plugin

```diff
+ import platformMock from '00_srf-news-platform-mock/vite'
+
- import { name } from './package.json'
+ import pkg from './package.json'
+
+ const { name } = pkg

  export default defineConfig({
    plugins: [
+     platformMock({ brand: pkg.config.mock }),
      react(),
      createHtmlPlugin({ … }),
```

Put it first: it writes the entry HTML before Vite reads it, and its `<%= id %>`
/ `<%= title %>` placeholders are still filled in by `createHtmlPlugin` exactly
as before.

### 5. Clean up the symlinks and `.gitignore`

```sh
rm -f index.html
rm -rf public/sandbox-assets
```

`.gitignore` keeps `/index.html`, and `public/sandbox-assets` is no longer
created at all — that line can stay as a harmless leftover or be removed.

### 6. Optional: drop the exclude plugin

`newsSrfSandboxExcludePlugin` deleted `dist/index.html` and
`dist/sandbox-assets/` after every build. With `buildHtml: 'minimal'` (the
default) the mock chrome never enters the build, so the plugin has nothing left
to remove.

Keep it if something downstream relies on `dist/index.html` being absent —
`vite build` still writes a small one, and the exclude plugin still removes it.

### 7. Verify

```sh
pnpm install
pnpm dev            # platform chrome around your article, no 404s
pnpm build          # check dist/ contains no mock-assets/
```

The dev server logs which mock it picked up:

```
➜  platform mock: srf (lang de, generated 2026-09-01) — assets streamed from node_modules
```

## Switching brands

Same field as before, under its new name — `config.mock` in `package.json` — but
a dev-server restart is now enough, no reinstall. `pnpm run translate` needs one
adjustment: it can stop running `pnpm i` after changing the brand.

Per-run override without touching `package.json`:

```sh
PLATFORM_MOCK_BRAND=rts pnpm dev
```

## If you need the old behaviour

`assets: 'copy'` reproduces the symlink setup as a real copy — assets are
mirrored into `public/mock-assets` and become part of the build output:

```js
platformMock({ brand: pkg.config.mock, assets: 'copy', buildHtml: 'mock' })
```

Add `public/mock-assets` back to `.gitignore` if you use it.

## What is not here

The **theme generator** (`pnpm theme`, `theme-override/themeVariables.scss`, the
`_newsColors.scss` lookup) was deliberately left out. It scrapes dark-mode CSS
and emits SCSS for the template's `cmsOverrides/themeVariables.scss` — a
different job with a different output, and it reached back into
`00_srf-news-template` to read its colour variables.

Keep using the existing theme tooling where it lives today, or move the
generator into the template repo itself, where the SCSS it reads and writes
already lives.
