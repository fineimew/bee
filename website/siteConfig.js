/* See https://docusaurus.io/docs/site-config.html for all the possible site configuration options. */

const siteConfig = {
  title: 'Open Power Quality' ,
  tagline: 'Open source hardware and software for low-cost distributed power quality data collection, analysis, and visualization.',
  url: 'https://openpowerquality.org' ,
  baseUrl: '/',
  projectName: 'docusaurus',
  organizationName: 'openpowerquality',
  headerLinks: [
    {doc: 'intro-motivation', label: 'Documentation'},
    {doc: 'other-opportunities', label: 'Opportunities'},
    {blog: true, label: 'News'},
  ],

  algolia: { apiKey: '9bf16cc78135dbeeb3826894ebbbb2ee', indexName: 'openpowerquality' },

  headerIcon: 'img/opqlogo_white.png',
  footerIcon: 'img/opqlogo_white.png',
  favicon: 'img/opq.ico',

  colors: {
    primaryColor: "#0587b3",
    secondaryColor: "#6fc1f0",
    tintColor: "#005068",
    backgroundColor: "#e9faff"
  },

  copyright: 'Copyright © ' + new Date().getFullYear() + 'Open Power Quality',

  highlight: { theme: 'default' },

  markdownPlugins: [function(md) {
  }],

  scripts: ['https://buttons.github.io/buttons.js', 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.4/MathJax.js?config=TeX-MML-AM_CHTML', '/js/mathjax-config.js'],

  stylesheets: ['https://fonts.googleapis.com/css?family=Gugi'],

  onPageNav: 'separate',
  blogSidebarCount: 'ALL',
};

module.exports = siteConfig;
