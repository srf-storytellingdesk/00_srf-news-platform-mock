import { COMMON_DELETE_SELECTORS, PLACEHOLDER } from './_shared.js'

/** @type {import('./_shared.js').BrandConfig} */
export default {
  label: 'SRF',
  lang: 'de',

  fetchUrl:
    'https://www.srf.ch/news/dialog/fehlende-berichterstattung-humanitaere-krisen-ohne-aufmerksamkeit',

  embedTemplate: 'embed_default.html',
  tmeTemplate: 'tme_default.html',

  deleteSelectors: [...COMMON_DELETE_SELECTORS],

  insertSelectors: {
    '^main.articlepage article': '{{TOP_MEDIA_ELEMENT}}',
  },

  textReplacements: {
    title: '{{ARTICLE_TITLE}}',
    '[data-news-landmark="article-content"]': '{{ARTICLE_CONTENT}}',
    '.article-title__overline': PLACEHOLDER.overline,
    '.article-title__text': PLACEHOLDER.title,
    ".article-author__name span[itemprop='name']": PLACEHOLDER.authors,
    '.article-lead': PLACEHOLDER.lead,
  },
}
