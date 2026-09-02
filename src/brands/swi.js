import { COMMON_DELETE_SELECTORS, PLACEHOLDER } from './_shared.js'

/** @type {import('./_shared.js').BrandConfig} */
export default {
  label: 'SWI swissinfo.ch',
  lang: 'en',

  fetchUrl:
    'https://www.swissinfo.ch/eng/global-trade/swiss-group-supports-gulf-oil-and-gas-repairs/91632308',

  embedTemplate: 'embed_swi.html',
  tmeTemplate: 'tme_default.html',

  deleteSelectors: [
    ...COMMON_DELETE_SELECTORS,
    // Drop the real article body but keep the meta rows around it.
    'main article .article-main > *:not(.article-meta-list):not(.article-meta-row)',
  ],

  insertSelectors: {
    'main article .article-main': '{{ARTICLE_CONTENT}}',
  },

  textReplacements: {
    title: '{{ARTICLE_TITLE}}',
    '.article-title__overline': PLACEHOLDER.overline,
    'main article .article-header h1': PLACEHOLDER.title,
    '.article-authors .author__title': PLACEHOLDER.authors,
    'h2.lead-text__content': PLACEHOLDER.lead,
  },
}
