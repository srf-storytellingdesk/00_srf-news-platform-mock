/**
 * Pieces every brand config reuses. Not a brand itself — the generator only
 * accepts `[a-z0-9-]+` as a brand key, so this file can never be scraped.
 */

/**
 * Elements that must go on every platform: anything that needs JavaScript, a
 * consent layer or a live backend to make sense in an offline mock.
 */
export const COMMON_REMOVAL_MODS = [
  'script',
  'meta:not([charset]):not([name=viewport])',
  'link[as="script"]',
  "[style^='display: none']",
  'noscript',
].map((selector) => ({ selector, action: 'remove' }))

/**
 * Filler copy that replaces the real article text, so no mock ever ships
 * editorial content it is not allowed to redistribute.
 */
export const PLACEHOLDER = {
  overline: 'Spitzmarke',
  title: 'Titel des Artikes',
  authors: 'Pascal Albisser, Balz Rittmeyer, Robert Salzer, Fabian Schwander',
  lead:
    'Hier folgt der Lead-Text, der in der Regel eine kurze Zusammenfassung ' +
    'des Artikels enthält und die Aufmerksamkeit der Leser auf sich ziehen soll.',
}

/**
 * @typedef {object} Mount
 * @property {string} selector
 *   Element a template fork mounts its article into. Baked into `mock.json`
 *   as `entryPointSelector`.
 * @property {'replace'|'append'|'prepend'} [action]
 *   How the partial is spliced in relative to that element's content.
 *   Defaults to `replace`.
 * @property {string} template Partial in `src/partials/` to splice in.
 */

/**
 * One edit to the scraped page. `remove` drops every match; the other actions
 * put content into the first match — `text` as a literal string, or the
 * partial named by `template`.
 * @typedef {object} Mod
 * @property {string} selector
 * @property {'remove'|'replace'|'append'|'prepend'} [action]
 *   Defaults to `replace`.
 * @property {string} [text]     Inline content.
 * @property {string} [template] Partial in `src/partials/`.
 */

/**
 * @typedef {object} BrandConfig
 * @property {string} label    Human-readable platform name.
 * @property {string} lang     Value for the mock's `<html lang>`.
 * @property {string} fetchUrl Article page to scrape.
 * @property {Mount} mount     Where a template fork mounts its article.
 * @property {Mod[]} mods
 *   Edits applied in order before the mount: strip what needs a live backend
 *   and swap editorial copy for placeholders.
 * @property {RegExp[]} [keepScripts]
 *   Absolute URLs of platform scripts the mock keeps, even though a mod
 *   removes `script`.
 * @property {Record<string, Partial<BrandConfig>>} [layouts]
 *   Further mocks scraped from other article types, written to
 *   `mocks/<brand>--<layout>/`. Top-level keys replace the base ones — a layout
 *   that sets `mods` restates them all — while `mount` merges key by key.
 */
