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
 * @typedef {object} BrandConfig
 * @property {string} label      Human-readable platform name.
 * @property {string} lang       Value for the mock's `<html lang>`.
 * @property {string} fetchUrl   Article page to scrape.
 * @property {string} [embedTemplate] Partial spliced in for `{{ARTICLE_CONTENT}}`.
 * @property {string} [tmeTemplate]   Partial spliced in for `{{TOP_MEDIA_ELEMENT}}`.
 * @property {string[]} deleteSelectors Elements to remove.
 * @property {Record<string,string>} insertSelectors
 *   `selector -> text`; appends, or prepends when the selector starts with `^`.
 * @property {Record<string,string>} textReplacements
 *   `selector -> text`; replaces the element's text content.
 */
