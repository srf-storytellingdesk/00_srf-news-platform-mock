import { COMMON_MODS, PLACEHOLDER } from './_shared.js'

/** @type {import('./_shared.js').BrandConfig} */
export default {
  label: 'RSI',
  lang: 'it',

  fetchUrl:
    'https://www.rsi.ch/info/natura-e-animali/Morso-di-vipera-quanto-%C3%A8-davvero-pericoloso-in-Svizzera--3837425.html',

  mount: {
    selector: '.c-article-body',
    action: 'append',
    template: 'embed_rsi.html',
  },

  mods: [
    ...COMMON_MODS,
    // Drop the real article body but keep the credits line as a placeholder.
    {
      selector: '.c-article-body .c-article-body_item:not(.c-article-credits)',
      action: 'remove',
    },
    { selector: 'title', text: '{{ARTICLE_TITLE}}' },
    { selector: '.c-article-header h1', text: PLACEHOLDER.title },
    { selector: '.c-article-credits span span', text: PLACEHOLDER.authors },
    { selector: '.c-article-header h2', text: PLACEHOLDER.lead },
  ],
}
