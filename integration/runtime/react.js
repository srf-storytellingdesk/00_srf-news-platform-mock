/**
 * What a fork imports into its own bundle:
 *
 *   import { useMockVariables } from '00_srf-news-platform-mock/react'
 *
 * The one supported way to ask which platform the article is mounted in, and
 * where. It answers in every build — with the plugin it reports the mock, and
 * without it (the fork's production bundle for the CMS) every variable is
 * `null`, so a fork branches on data instead of on whether a global happens to
 * exist.
 *
 * `react` is an optional peer dependency. Nothing else in this package imports
 * this module, so a fork without React never pulls it in.
 */
import { mockVariables } from './values.js'

/**
 * @typedef {object} MockVariables
 * @property {string|null} platform   `'srf' | 'rts' | 'rsi' | 'rtr' | 'swi'`,
 *   or `null` when this build is not running against a mock at all.
 * @property {string|null} label      Human-readable platform name.
 * @property {string|null} lang       The mock's `<html lang>`.
 * @property {string|null} entryPoint Selector of the article mount point.
 */

/**
 * Everything the package knows about the mock in this build. Frozen and
 * constant for the lifetime of the bundle, so it never triggers a re-render
 * and is safe in any dependency array.
 *
 *   const { platform, lang, entryPoint } = useMockVariables()
 *
 * @returns {Readonly<MockVariables>}
 */
export function useMockVariables() {
  return mockVariables
}
