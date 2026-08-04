import { useEffect } from 'react';

/**
 * Per-page title and description.
 *
 * A single-page app serves one index.html, so without this every route shares
 * the homepage's title — which is what someone sees in their browser tab, in
 * their history, and when they bookmark a page.
 *
 * This is not a substitute for server rendering. Crawlers that execute
 * JavaScript will see these values; ones that do not will see index.html. If
 * search ranking on the inner pages becomes important, the answer is
 * pre-rendering at build time, not more work here.
 */
export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} — AC7 GROUP`;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = meta?.content;

    if (description) {
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = description;
    }

    return () => {
      document.title = previousTitle;
      if (meta && previousDescription !== undefined) meta.content = previousDescription;
    };
  }, [title, description]);
}
