import React from 'react';
import GiscusReact from '@giscus/react';
import { useColorMode } from '@docusaurus/theme-common';

export default function Giscus() {
	const { colorMode } = useColorMode();

	return (
		<GiscusReact
			repo="darlinghq/blog"
			repoId="R_kgDOJlSqQQ"
			category="Blog Comments"
			categoryId="DIC_kwDOJlSqQc4CWn3C"
			mapping="pathname"
			strict="1"
			reactionsEnabled="1"
			emit-metadata="0"
			inputPosition="bottom"
			theme={colorMode}
			lang="en"
			loading="lazy"
		/>
	);
};
