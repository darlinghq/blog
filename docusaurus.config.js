// @ts-check

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @returns {Promise<import('@docusaurus/types').Config>} */
async function createConfig() {
	const { default: remarkGithub } = await import('remark-github');

	return {
		title: 'Darling Development Blog',
		tagline: 'macOS translation layer for Linux',
		favicon: 'img/favicon.ico',

		url: 'https://blog.darlinghq.org',
		baseUrl: '/',

		// GitHub pages deployment config.
		organizationName: 'darlinghq',
		projectName: 'blog',

		onBrokenLinks: 'throw',
		onBrokenMarkdownLinks: 'warn',

		i18n: {
			defaultLocale: 'en',
			locales: ['en'],
		},

		presets: [
			[
				'classic',
				/** @type {import('@docusaurus/preset-classic').Options} */
				({
					docs: false,
					blog: {
						blogTitle: 'Darling Development Blog',
						blogDescription: 'macOS translation layer for Linux',
						routeBasePath: '/',
						showReadingTime: true,
						editUrl: 'https://github.com/darlinghq/blog/tree/main/',
						postsPerPage: 'ALL',
						blogSidebarTitle: 'All posts',
						blogSidebarCount: 'ALL',
						remarkPlugins: [
							[remarkGithub, {
								repository: 'darlinghq/darling',
							}],
						],
						feedOptions: {
							type: 'all',
							copyright: `Copyright © ${new Date().getFullYear()} Darling developers`,
						},
					},
					theme: {
						customCss: require.resolve('./src/css/custom.css'),
					},
				}),
			],
		],

		themeConfig:
			/** @type {import('@docusaurus/preset-classic').ThemeConfig} */
			({
				// Replace with your project's social card
				//image: 'img/darling-social-card.jpg',
				navbar: {
					title: 'Darling Development Blog',
					logo: {
						alt: 'Darling',
						src: 'img/logo.svg',
					},
					items: [
						{
							href: 'https://github.com/darlinghq/darling',
							label: 'GitHub',
							position: 'right',
						},
					],
				},
				footer: {
					style: 'dark',
					links: [
						{
							title: 'More',
							items: [
								{
									label: 'GitHub',
									href: 'https://github.com/darlinghq/darling',
								},
							],
						},
					],
					copyright: `Copyright © ${new Date().getFullYear()} Darling developers. Built with Docusaurus.`,
				},
				prism: {
					theme: lightCodeTheme,
					darkTheme: darkCodeTheme,
					additionalLanguages: ['cmake', 'nasm'],
				},
				colorMode: {
					respectPrefersColorScheme: true,
				},
			}),
	};
};

module.exports = createConfig;
