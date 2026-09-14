/**
 * Ambient declarations for the `__MOCK_*` constants the Vite plugin injects.
 * A TypeScript fork pulls them in once, instead of restating them:
 *
 *   /// <reference types="00_srf-news-platform-mock/globals" />
 *
 * These only exist in a build the plugin is part of — reading one anywhere
 * else is a `ReferenceError`, which is why they are typed as possibly
 * undefined. For code that has to work in the fork's production build too,
 * use `useMockVariables()` instead.
 */
import type { MockPlatform } from './runtime/react.js'

declare global {
  /** Brand key the mock plugin was configured with. */
  const __MOCK_PLATFORM__: MockPlatform | undefined
  /** The mock's `<html lang>`. */
  const __MOCK_LANG__: string | undefined
  /** Selector of the article mount point, `null` if the mock records none. */
  const __MOCK_ENTRY_POINT__: string | null | undefined
}

export {}
