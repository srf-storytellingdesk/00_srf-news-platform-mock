import { COMMON_DELETE_SELECTORS, PLACEHOLDER } from './_shared.js'

/** @type {import('./_shared.js').BrandConfig} */
export default {
  label: 'RTS',
  lang: 'fr',

  fetchUrl:
    'https://www.rts.ch/info/regions/vaud/2026/article/gale-dans-la-broye-les-cas-confirmes-sont-rares-dans-le-canton-de-vaud-29283692.html',

  embedTemplate: 'embed_rts.html',
  tmeTemplate: 'tme_default.html',

  deleteSelectors: [...COMMON_DELETE_SELECTORS],

  insertSelectors: {
    "^main[data-zone-id='content'] article": '{{TOP_MEDIA_ELEMENT}}',
  },

  textReplacements: {
    title: '{{ARTICLE_TITLE}}',
    '[data-area-id="article-content"] .article-body': '{{ARTICLE_CONTENT}}',
    '.article-category': PLACEHOLDER.overline,
    '.article-title': PLACEHOLDER.title,
    '.article-lead': PLACEHOLDER.lead,
  },
}
