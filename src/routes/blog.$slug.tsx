import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type Post = {
  id: string;
  title: string;
  slug: string;
  content: string;
  meta_description: string;
  featured_image_url: string | null;
  published_at: string | null;
};

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("blog_posts")
      .select(
        "id,title,slug,content,meta_description,featured_image_url,published_at",
      )
      .eq("slug", params.slug)
      .eq("published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw notFound();
    return { post: data as Post };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Post not found — FIT Beyond Plus" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { post } = loaderData;
    const url = `https://fitbeyondplus.com/blog/${post.slug}`;
    const meta: Array<Record<string, string>> = [
      { title: `${post.title} — FIT Beyond Plus` },
      { name: "description", content: post.meta_description || post.title },
      { property: "og:title", content: post.title },
      { property: "og:description", content: post.meta_description || post.title },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (post.featured_image_url) {
      meta.push({ property: "og:image", content: post.featured_image_url });
      meta.push({ name: "twitter:image", content: post.featured_image_url });
    }
    return { meta, links: [{ rel: "canonical", href: url }] };
  },
  errorComponent: ({ error }) => (
    <section className="container-page py-20">
      <p className="text-destructive">Unable to load post: {error.message}</p>
      <Link to="/blog" className="mt-6 inline-block text-primary underline">
        ← Back to Blog
      </Link>
    </section>
  ),
  notFoundComponent: () => (
    <section className="container-page py-20">
      <h1 className="text-3xl">Post not found</h1>
      <p className="mt-3 text-muted-foreground">
        This post may have been unpublished or moved.
      </p>
      <Link to="/blog" className="mt-6 inline-block text-primary underline">
        ← Back to Blog
      </Link>
    </section>
  ),
  component: BlogPost,
});

// Render very light formatting: split into paragraphs, allow line breaks.
// Content is authored by trusted admins; we still escape HTML and only
// render as plain text with paragraph breaks + auto-link URLs.
function renderContent(content: string) {
  const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim());
  return paragraphs.map((para, i) => (
    <p key={i} className="mt-5 text-muted-foreground leading-relaxed whitespace-pre-wrap">
      {para}
    </p>
  ));
}

function BlogPost() {
  const { post } = Route.useLoaderData();
  return (
    <article className="container-page py-20 max-w-3xl">
      <Link to="/blog" className="text-xs uppercase tracking-[0.2em] text-primary hover:underline">
        ← Back to Blog
      </Link>
      <h1 className="mt-6 text-4xl md:text-5xl">{post.title}</h1>
      {post.published_at && (
        <p className="mt-3 text-sm text-muted-foreground">
          {new Date(post.published_at).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      )}
      {post.featured_image_url && (
        <img
          src={post.featured_image_url}
          alt={post.title}
          className="mt-8 w-full rounded-lg border border-border"
        />
      )}
      <div className="mt-8">{renderContent(post.content)}</div>
      <div className="mt-16 border-t border-border pt-8">
        <Link to="/blog" className="text-primary hover:underline">
          ← Back to Blog
        </Link>
      </div>
    </article>
  );
}
