import { COMMON_MODS, PLACEHOLDER } from './_shared.js'

/** @type {import('./_shared.js').BrandConfig} */
export default {
  label: 'RTS',
  lang: 'fr',

  fetchUrl:
    'https://www.rts.ch/info/regions/vaud/2026/article/gale-dans-la-broye-les-cas-confirmes-sont-rares-dans-le-canton-de-vaud-29283692.html',

  mount: {
    selector: '[data-area-id="article-content"] .article-body',
    template: 'embed_rts.html',
  },

  mods: [
    ...COMMON_MODS,
    { selector: 'title', text: '{{ARTICLE_TITLE}}' },
    { selector: '.article-category', text: PLACEHOLDER.overline },
    { selector: '.article-title', text: PLACEHOLDER.title },
    { selector: '.article-lead', text: PLACEHOLDER.lead },
  ],
}
