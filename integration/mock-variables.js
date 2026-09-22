/**
 * What this package tells a fork about the mock it is running against.
 *
 * One list, and two functions around it: the plugin writes the variables into
 * the page it generates, and `integration/react.js` reads them back out. There
 * is no bundler magic involved — the values travel in the document, which is
 * also the reason a fork's production build (a CMS page, not a generated mock)
 * reports no mock at all.
 *
 * Add a variable here and nowhere else — and add one sparingly. This is a
 * surface a fork has to learn; anything it can read off the mock's own DOM
 * does not belong in it.
 */

/**
 * The element the variables travel in. A JSON block rather than attributes:
 * nothing to escape, nothing executes, and it reads as itself in devtools.
 */
export const MOCK_VARIABLES_SELECTOR = 'script[data-platform-mock]'

/**
 * Every variable a fork can read, in the order they are documented.
 * @type {{key: string, describe: string, read: (mock: import('./index.js').Mock) => string|null}[]}
 */
export const MOCK_VARIABLES = [
  {
    key: 'platform',
    describe: 'Brand key the plugin was configured with.',
    read: (mock) => mock.brand,
  },
  {
    key: 'label',
    describe: 'Human-readable platform name, for dev-only UI.',
    read: (mock) => mock.manifest.label ?? mock.brand.toUpperCase(),
  },
  {
    key: 'lang',
    describe: "The mock's `<html lang>`.",
    read: (mock) => mock.lang,
  },
  {
    key: 'entryPoint',
    describe: 'Selector of the article mount point, from `mock.json`.',
    read: (mock) => mock.manifest.entryPointSelector ?? null,
  },
]

/**
 * What `useMockVariables()` answers when there is no mock in the page. Every
 * key the plugin can write exists here, `null`, so a fork never has to guard
 * against a missing one — a test keeps this in step with the list above.
 */
export const NO_MOCK_VARIABLES = Object.freeze({
  platform: null,
  label: null,
  lang: null,
  entryPoint: null,
})

/**
 * Resolves the variables for one mock — the exact object the hook returns.
 * @param {import('./index.js').Mock} mock
 * @returns {Record<string, string|null>}
 */
export function mockVariables(mock) {
  return Object.fromEntries(
    MOCK_VARIABLES.map((variable) => [variable.key, variable.read(mock)]),
  )
}

/**
 * The JSON block to put in the generated document's `<head>`. Classic markup,
 * so it is parsed long before the fork's deferred module script runs.
 * @param {import('./index.js').Mock} mock
 * @returns {string}
 */
export function mockVariablesScript(mock) {
  const json = JSON.stringify(mockVariables(mock))
  return `<script type="application/json" data-platform-mock>${json}</script>`
}
