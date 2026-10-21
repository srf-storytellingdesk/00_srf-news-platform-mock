import { COMMON_DELETE_SELECTORS, PLACEHOLDER } from './_shared.js'

/** @type {import('./_shared.js').BrandConfig} */
export default {
  label: 'RTS',
  lang: 'fr',

  fetchUrl:
    'https://www.rts.ch/info/regions/vaud/2026/article/gale-dans-la-broye-les-cas-confirmes-sont-rares-dans-le-canton-de-vaud-29283692.html',

  mounts: {
    article: {
      selector: '[data-area-id="article-content"] .article-body',
      mode: 'replace',
      template: 'embed_rts.html',
    },
    topMedia: {
      selector: "main[data-zone-id='content'] article",
      mode: 'prepend',
      template: 'tme_default.html',
    },
  },

  deleteSelectors: [...COMMON_DELETE_SELECTORS],

  keepScripts: [/\/hbv7\/static\/js\/rts-[^/]*\.js$/],

  textReplacements: {
    title: '{{ARTICLE_TITLE}}',
    '.article-category': PLACEHOLDER.overline,
    '.article-title': PLACEHOLDER.title,
    '.article-lead': PLACEHOLDER.lead,
  },

  layouts: {
    // A full-bleed embed with no article header of its own.
    fullwidth: {
      fetchUrl:
        'https://www.rts.ch/info/monde/2026/article/bikini-l-histoire-de-l-exil-face-aux-essais-nucleaires-29269618.html',
      mounts: {
        article: {
          selector:
            '[data-area-id="article-content"] .rts-full-width-container .raw_html .embed-content',
          mode: 'replace',
          template: 'embed_rts_fullwidth.html',
        },
        topMedia: null,
      },
      textReplacements: {
        title: '{{ARTICLE_TITLE}}',
      },
    },
  },
}
