import { COMMON_REMOVAL_MODS, PLACEHOLDER } from './_shared.js'

/** @type {import('./_shared.js').BrandConfig} */
export default {
  label: 'RTS',
  lang: 'fr',

  fetchUrl:
    'https://www.rts.ch/info/monde/2026/article/comment-reconstruire-le-nid-d-aigle-d-hitler-apres-l-incendie-29398695.html',

  mount: {
    selector: '[data-area-id="article-content"] .article-body',
    template: 'embed_rts.html',
  },

  mods: [
    ...COMMON_REMOVAL_MODS,
    { selector: 'title', text: '{{ARTICLE_TITLE}}' },
    { selector: '.article-category', text: PLACEHOLDER.overline },
    { selector: '.article-title', text: PLACEHOLDER.title },
    { selector: '.article-lead', text: PLACEHOLDER.lead },
  ],

  keepScripts: [/\/hbv7\/static\/js\/rts-[^/]*\.js$/],

  layouts: {
    // A full-bleed embed with no article header of its own.
    fullwidth: {
      fetchUrl:
        'https://www.rts.ch/info/monde/2026/article/bikini-l-histoire-de-l-exil-face-aux-essais-nucleaires-29269618.html',
      mount: {
        selector:
          '[data-area-id="article-content"] .rts-full-width-container .raw_html .embed-content',
        action: 'replace',
        template: 'embed_rts_fullwidth.html',
      },
      mods: [
        ...COMMON_REMOVAL_MODS,
        { selector: 'title', text: '{{ARTICLE_TITLE}}' },
      ],
    },
  },
}
