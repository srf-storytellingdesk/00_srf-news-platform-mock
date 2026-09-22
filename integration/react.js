/**
 * What a fork imports into its own bundle:
 *
 *   import { useMockVariables } from '00_srf-news-platform-mock/react'
 *
 * The one supported way to ask which platform the article is mounted in, and
 * where. It reads the JSON block the Vite plugin writes into the mock document
 * — see `mock-variables.js` — and answers in every build: outside a mock
 * (the fork's production bundle, running in a real CMS page) there is no such
 * block, so every variable is `null` and nothing throws.
 */
import { MOCK_VARIABLES_SELECTOR, NO_MOCK_VARIABLES } from './mock-variables.js'

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
  if (typeof document === 'undefined') return NO_MOCK_VARIABLES

  const block = document.querySelector(MOCK_VARIABLES_SELECTOR)
  if (!block) return NO_MOCK_VARIABLES

  try {
    return Object.freeze({
      ...NO_MOCK_VARIABLES,
      ...JSON.parse(block.textContent),
    })
  } catch (error) {
    console.warn(
      `[platform-mock] Ignoring unreadable variables: ${error.message}`,
    )
    return NO_MOCK_VARIABLES
  }
}
