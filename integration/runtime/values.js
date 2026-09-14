/**
 * The values behind `useMockVariables()`.
 *
 * THIS FILE IS A FALLBACK. When the Vite plugin is in the pipeline it swaps
 * this module for one holding the real mock's literals — see `resolveId`/
 * `load` in `integration/vite.js`. What is written here is therefore what a
 * fork sees when it is *not* running against a mock: its production build for
 * the CMS, a test runner, a Storybook without the plugin.
 *
 * So: every key the plugin can inject must exist here, `null`, and consumers
 * never have to guard against a missing one. `src/mock-variables.test.js`
 * asserts this object's keys match the catalogue in
 * `integration/mock-variables.js` exactly.
 */
export const mockVariables = Object.freeze({
  platform: null,
  label: null,
  lang: null,
  entryPoint: null,
})
