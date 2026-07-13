import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type PostListItem = {
  id: string;
  title: string;
  slug: string;
  meta_description: string;
  featured_image_url: string | null;
  published_at: string | null;
};

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog — FIT Beyond Plus | Tullahoma, TN" },
      {
        name: "description",
        content: "News, training tips, and updates from FIT Beyond Plus in Tullahoma, TN.",
      },
      { property: "og:title", content: "FIT Beyond Plus Blog" },
      {
        property: "og:description",
        content: "Training tips, gym news, and updates from FIT Beyond Plus.",
      },
      { property: "og:url", content: "https://fitbeyondplus.com/blog" },
    ],
    links: [{ rel: "canonical", href: "https://fitbeyondplus.com/blog" }],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const [posts, setPosts] = useState<PostListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("blog_posts")
      .select("id,title,slug,meta_description,featured_image_url,published_at")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setPosts(data ?? []);
      });
  }, []);

  return (
    <section className="container-page py-20">
      <p className="text-xs tracking-[0.3em] text-primary">THE BLOG</p>
      <h1 className="mt-3 text-4xl md:text-5xl">FIT Beyond Plus Blog</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Training tips, gym news, and updates from our team in Tullahoma.
      </p>

      {error && <p className="mt-10 text-sm text-destructive">Unable to load posts: {error}</p>}

      {posts && posts.length === 0 && (
        <p className="mt-10 text-muted-foreground">No posts yet. Check back soon.</p>
      )}

      <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {posts?.map((p) => (
          <Link
            key={p.id}
            to="/blog/$slug"
            params={{ slug: p.slug }}
            className="group border border-border bg-card rounded-lg overflow-hidden hover:border-primary transition-colors"
          >
            {p.featured_image_url && (
              <img
                src={p.featured_image_url}
                alt={p.title}
                loading="lazy"
                className="aspect-[16/9] w-full object-cover"
              />
            )}
            <div className="p-6">
              {p.published_at && (
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {new Date(p.published_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
              <h2 className="mt-2 text-xl group-hover:text-primary transition-colors">{p.title}</h2>
              {p.meta_description && (
                <p className="mt-3 text-sm text-muted-foreground line-clamp-3">
                  {p.meta_description}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
