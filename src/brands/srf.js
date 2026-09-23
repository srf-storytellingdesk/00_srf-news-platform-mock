import { COMMON_DELETE_SELECTORS, PLACEHOLDER } from './_shared.js'

/** @type {import('./_shared.js').BrandConfig} */
export default {
  label: 'SRF',
  lang: 'de',

  fetchUrl:
    'https://www.srf.ch/news/dialog/fehlende-berichterstattung-humanitaere-krisen-ohne-aufmerksamkeit',

  mounts: {
    article: {
      selector: '[data-news-landmark="article-content"]',
      mode: 'replace',
      template: 'embed_default.html',
    },
    topMedia: {
      selector: 'main.articlepage article',
      mode: 'prepend',
      template: 'tme_default.html',
    },
  },

  deleteSelectors: [...COMMON_DELETE_SELECTORS],

  textReplacements: {
    title: '{{ARTICLE_TITLE}}',
    '.article-title__overline': PLACEHOLDER.overline,
    '.article-title__text': PLACEHOLDER.title,
    ".article-author__name span[itemprop='name']": PLACEHOLDER.authors,
    '.article-lead': PLACEHOLDER.lead,
  },
}
