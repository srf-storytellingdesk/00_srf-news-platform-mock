/**
 * What a fork imports into its own bundle:
 *
 *   import { useMockVariables } from '00_srf-news-platform-mock/react'
 *
 * The one supported way to ask which platform the article is mounted in, and
 * where. In a bundle built with the Vite plugin the values are compiled in
 * (`INLINED_VARIABLES` below), so the production bundle in a real CMS page knows
 * them too. Otherwise it reads the JSON block the plugin writes into the mock
 * document — see `mock-variables.js`. With neither, it answers with an empty
 * object — every variable `undefined` — and nothing throws.
 */
import { MOCK_VARIABLES_SELECTOR } from './mock-variables.js'

/** The answer when there is no mock: every variable `undefined`. */
const NO_MOCK = Object.freeze({})

/**
 * The variables compiled into the bundle. The Vite plugin rewrites this line
 * in a fork's build (see `transform` in `vite.js`); without the plugin it stays
 * `null` and the hook reads the block in the document instead.
 */
const INLINED_VARIABLES = null

/** Read once, on first use: the document cannot change under us. */
let variables

/**
 * Everything the package knows about the mock in this build. Frozen and
 * constant for the lifetime of the page, so it never triggers a re-render and
 * is safe in any dependency array.
 *
 *   const { platform, label, entryPoint } = useMockVariables()
 *
 * @returns {Readonly<import('./react.d.ts').MockVariables>}
 */
export function useMockVariables() {
  variables ??= readMockVariables()
  return variables
}

function readMockVariables() {
  // Compiled in by the Vite plugin — the only source in a production bundle.
  if (INLINED_VARIABLES) {
    return Object.freeze(INLINED_VARIABLES)
  }

  if (typeof document === 'undefined') return NO_MOCK

  const block = document.querySelector(MOCK_VARIABLES_SELECTOR)
  if (!block) return NO_MOCK

  try {
    return Object.freeze(JSON.parse(block.textContent))
  } catch (error) {
    console.warn(
      `[platform-mock] Ignoring unreadable variables: ${error.message}`,
    )
    return NO_MOCK
  }
}
