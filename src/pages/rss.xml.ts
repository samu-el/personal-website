import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { site } from '@/lib/site';
import { href } from '@/lib/paths';

export const GET: APIRoute = async (context) => {
  const posts = (await getCollection('posts', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );

  return rss({
    title: `${site.name} — Writing`,
    description:
      'Essays on hiring senior engineers, running distributed teams, and shipping AI features that survive contact with users.',
    site: context.site ?? 'https://samu-el.github.io',
    trailingSlash: false,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: href(`/writing/${post.id}`),
      categories: post.data.tags,
      author: `${site.email} (${site.name})`,
    })),
    customData: `<language>en-us</language><copyright>© ${new Date().getFullYear()} ${site.name}</copyright>`,
  });
};
