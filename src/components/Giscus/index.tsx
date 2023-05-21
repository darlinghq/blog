import React from 'react';
import GiscusReact from '@giscus/react';
import { useColorMode } from '@docusaurus/theme-common';

export default function Giscus() {
	const { colorMode } = useColorMode();

	return (
		<GiscusReact
			repo="darlinghq/darling"
			repoId="MDEwOlJlcG9zaXRvcnk3MDc3Njkw"
			category="Blog comments"
			categoryId="DIC_kwDOAGv_Os4CWo3g"
			mapping="title"
			strict="1"
			reactionsEnabled="1"
			emitMetadata="0"
			inputPosition="bottom"
			theme={colorMode}
			lang="en"
			loading="lazy"
		/>
	);
};
