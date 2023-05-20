import React from 'react';
import BlogPostItem from '@theme-original/BlogPostItem';
import { useBlogPost } from '@docusaurus/theme-common/internal';
import Giscus from '@site/src/components/Giscus';

export default function BlogPostItemWrapper(props) {
  const { metadata, isBlogPostPage } = useBlogPost();

  const { frontMatter, slug, title } = metadata;
  const disableComments = (typeof frontMatter.disableComments === 'boolean') ? frontMatter.disableComments : false;

  return (
    <>
      <BlogPostItem {...props} />
      {(!disableComments && isBlogPostPage) && <Giscus />}
    </>
  );
}
