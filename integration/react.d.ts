/**
 * Types for `00_srf-news-platform-mock/react`. Hand-written: the package is
 * plain JavaScript, and TypeScript does not read JSDoc out of node_modules.
 * Keep in sync with `react.js` — `src/mock-variables.test.js` checks that this
 * file mentions every variable in the catalogue.
 */

export type MockPlatform = 'srf' | 'rts' | 'rsi' | 'rtr' | 'swi'

/** Everything this package tells a fork about the mock in the current build. */
export interface MockVariables {
  /** Brand key, or `null` in a build that is not running against a mock. */
  platform: MockPlatform | null
  /** Human-readable platform name, for dev-only UI. */
  label: string | null
  /** The mock's `<html lang>`. */
  lang: string | null
  /** Selector of the article mount point. */
  entryPoint: string | null
}

export function useMockVariables(): Readonly<MockVariables>
