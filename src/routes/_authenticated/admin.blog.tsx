import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  content: string;
  meta_description: string;
  featured_image_url: string | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/blog")({
  component: AdminBlog,
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type FormState = {
  id: string | null;
  title: string;
  slug: string;
  slugDirty: boolean;
  content: string;
  meta_description: string;
  featured_image_url: string;
  published: boolean;
};

const emptyForm: FormState = {
  id: null,
  title: "",
  slug: "",
  slugDirty: false,
  content: "",
  meta_description: "",
  featured_image_url: "",
  published: false,
};

function AdminBlog() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Reuse the same admin gating as the Lead Tracker: has_role('admin').
  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate({ to: "/admin/login" });
        return;
      }
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      if (error || !data) {
        toast.error("Admin access required");
        navigate({ to: "/admin/login" });
        return;
      }
      setIsAdmin(true);
    })();
  }, [navigate]);

  async function loadPosts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setPosts((data as BlogPost[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin) loadPosts();
  }, [isAdmin]);

  const editing = form.id !== null;
  const computedSlug = useMemo(
    () => (form.slugDirty ? form.slug : slugify(form.title)),
    [form.title, form.slug, form.slugDirty],
  );

  function resetForm() {
    setForm(emptyForm);
  }

  function editPost(p: BlogPost) {
    setForm({
      id: p.id,
      title: p.title,
      slug: p.slug,
      slugDirty: true,
      content: p.content,
      meta_description: p.meta_description,
      featured_image_url: p.featured_image_url ?? "",
      published: p.published,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(publish: boolean) {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const slug = computedSlug || slugify(form.title);
    if (!slug) {
      toast.error("Slug could not be generated");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      slug,
      content: form.content,
      meta_description: form.meta_description,
      featured_image_url: form.featured_image_url.trim() || null,
      published: publish,
      published_at: publish ? new Date().toISOString() : null,
    };

    let error;
    if (form.id) {
      // Preserve original published_at if already published
      const existing = posts.find((p) => p.id === form.id);
      if (existing?.published && existing.published_at && publish) {
        payload.published_at = existing.published_at;
      }
      ({ error } = await supabase
        .from("blog_posts")
        .update(payload)
        .eq("id", form.id));
    } else {
      ({ error } = await supabase.from("blog_posts").insert(payload));
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(publish ? "Post published" : "Draft saved");
    resetForm();
    loadPosts();
  }

  async function deletePost(id: string) {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Post deleted");
    if (form.id === id) resetForm();
    loadPosts();
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  }

  if (isAdmin === null) {
    return (
      <div className="container-page py-20 text-muted-foreground">Checking access…</div>
    );
  }

  return (
    <div className="container-page py-12 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-[0.3em] text-primary">ADMIN</p>
          <h1 className="mt-1 text-3xl">Blog Editor</h1>
        </div>
        <button
          onClick={signOut}
          className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          Sign Out
        </button>
      </div>

      {/* Editor */}
      <section className="mt-8 border border-border rounded-lg bg-card p-6">
        <h2 className="text-xl">{editing ? "Edit Post" : "New Post"}</h2>

        <div className="mt-5 grid gap-4">
          <label className="block">
            <span className="text-sm text-muted-foreground">Title</span>
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Post title"
            />
          </label>

          <label className="block">
            <span className="text-sm text-muted-foreground">
              Slug <span className="text-xs">(URL: /blog/{computedSlug || "…"})</span>
            </span>
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
              value={computedSlug}
              onChange={(e) =>
                setForm({ ...form, slug: slugify(e.target.value), slugDirty: true })
              }
              placeholder="auto-generated-from-title"
            />
          </label>

          <label className="block">
            <span className="text-sm text-muted-foreground">Meta Description (SEO)</span>
            <textarea
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
              rows={2}
              maxLength={200}
              value={form.meta_description}
              onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
              placeholder="Short description shown in search results and link previews"
            />
            <span className="text-xs text-muted-foreground">
              {form.meta_description.length}/200
            </span>
          </label>

          <label className="block">
            <span className="text-sm text-muted-foreground">Featured Image URL</span>
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
              value={form.featured_image_url}
              onChange={(e) =>
                setForm({ ...form, featured_image_url: e.target.value })
              }
              placeholder="https://…"
            />
            {form.featured_image_url && (
              <img
                src={form.featured_image_url}
                alt=""
                className="mt-3 max-h-40 rounded-md border border-border"
              />
            )}
          </label>

          <label className="block">
            <span className="text-sm text-muted-foreground">
              Content (blank line = new paragraph)
            </span>
            <textarea
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
              rows={16}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Write your post here…"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            disabled={saving}
            onClick={() => save(false)}
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-semibold uppercase tracking-wide hover:bg-secondary disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save as Draft"}
          </button>
          <button
            disabled={saving}
            onClick={() => save(true)}
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold uppercase tracking-wide text-primary-foreground hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Saving…" : editing ? "Update & Publish" : "Publish"}
          </button>
          {editing && (
            <button
              onClick={resetForm}
              className="inline-flex h-10 items-center rounded-md px-4 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </section>

      {/* Post list */}
      <section className="mt-10">
        <h2 className="text-xl">All Posts</h2>
        {loading ? (
          <p className="mt-4 text-muted-foreground">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="mt-4 text-muted-foreground">No posts yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-border border border-border rounded-lg bg-card">
            {posts.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{p.title || "(untitled)"}</span>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                        p.published
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    /blog/{p.slug} · updated{" "}
                    {new Date(p.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => editPost(p)}
                    className="text-xs uppercase tracking-wide text-primary hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deletePost(p.id)}
                    className="text-xs uppercase tracking-wide text-destructive hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
