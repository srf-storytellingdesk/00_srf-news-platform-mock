import { COMMON_REMOVAL_MODS, PLACEHOLDER } from './_shared.js'

/** @type {import('./_shared.js').BrandConfig} */
export default {
  label: 'SRF',
  lang: 'de',

  fetchUrl:
    'https://www.srf.ch/news/dialog/fehlende-berichterstattung-humanitaere-krisen-ohne-aufmerksamkeit',

  mount: {
    selector: '[data-news-landmark="article-content"]',
    template: 'embed_default.html',
  },

  mods: [
    ...COMMON_REMOVAL_MODS,
    { selector: 'link[crossorigin="use-credentials"]', action: 'remove' },
    { selector: '[data-js-plugin="dynamic-promo-banner"]', action: 'remove' },
    { selector: '#config__js', action: 'remove' },
    { selector: '[data-news-landmark="topmedia"]', action: 'remove' },
    { selector: 'title', text: '{{ARTICLE_TITLE}}' },
    { selector: '.article-title__overline', text: PLACEHOLDER.overline },
    { selector: '.article-title__text', text: PLACEHOLDER.title },
    {
      selector: ".article-author__name span[itemprop='name']",
      text: PLACEHOLDER.authors,
    },
    { selector: '.article-lead', text: PLACEHOLDER.lead },
  ],
}
