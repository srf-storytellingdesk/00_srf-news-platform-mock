/**
 * Pieces every brand config reuses. Not a brand itself — the generator only
 * accepts `[a-z0-9-]+` as a brand key, so this file can never be scraped.
 */

/**
 * Elements that must go on every platform: anything that needs JavaScript, a
 * consent layer or a live backend to make sense in an offline mock.
 */
export const COMMON_DELETE_SELECTORS = [
  'script',
  'meta:not([charset]):not([name=viewport])',
  'link[as="script"]',
  'link[crossorigin="use-credentials"]',
  '[data-js-plugin="dynamic-promo-banner"]',
  "[style^='display: none']",
  'noscript',
  '#config__js',
]

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
 * @property {string} selector Element a template fork mounts into.
 * @property {'replace'|'append'|'prepend'} [mode]
 *   How the partial is spliced in relative to that element's content.
 *   Defaults to `replace`.
 * @property {string} template Partial in `src/partials/` to splice in.
 */

/**
 * @typedef {object} BrandConfig
 * @property {string} label      Human-readable platform name.
 * @property {string} lang       Value for the mock's `<html lang>`.
 * @property {string} fetchUrl   Article page to scrape.
 * @property {object} mounts     Mount points a template fork needs.
 * @property {Mount} mounts.article
 *   The article body. Its selector is the mock's entry point and is baked into
 *   `mock.json` as `entryPointSelector`.
 * @property {Mount} [mounts.topMedia]
 *   The top-media slot. Omit on platforms that have none.
 * @property {string[]} deleteSelectors Elements to remove.
 * @property {Record<string,string>} textReplacements
 *   `selector -> text`; replaces the element's text content. Placeholder
 *   editorial copy only — mount points go in `mounts`.
 */
